// V13.180 10초 맞추기 효과음 11개(카운트다운 삑 · 시작 · 숨김 · 째깍 · 버튼 딸깍 · 공개 띠링 · 등급 4개 · 기록 갱신 팡파르).
// battle-synth.mjs의 악기를 그대로 쓰고, 전자 시계 · 오락실 버튼 느낌의 짧은 소리를 겹쳐 만든다(작게: 64~96kbps, 모두 0.1 ~ 2초).
// 사용: (npm i --no-save @breezystack/lamejs 뒤) node docs/sound/timing-synth.mjs <출력 폴더> → <key>.mp3 를 public/assets/sfx/에 넣는다.
// Layered game-SFX synthesis (offline render -> mono mp3). Usage: node synth.mjs <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Mp3Encoder } from '@breezystack/lamejs';

const SR = 44100, TAU = Math.PI * 2;
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const buf = sec => new Float32Array(Math.ceil(sec * SR));
const add = (dst, src, t0 = 0, g = 1) => { const o = Math.round(t0 * SR); for (let i = 0; i < src.length && i + o < dst.length; i++) dst[i + o] += src[i] * g; return dst; };
const scale = (x, g) => { for (let i = 0; i < x.length; i++) x[i] *= g; return x; };
const N = f => 440 * Math.pow(2, (f - 69) / 12); // midi -> Hz

// --- instruments ---
function bell(f, dur = 1.2, vel = 1, bright = 1) {
  const n = Math.ceil(dur * SR), o = new Float32Array(n);
  for (const [r, a, dm] of [[1, 1, 1], [2.76, .5 * bright, .5], [5.4, .26 * bright, .3], [8.93, .12 * bright, .18]]) {
    const fr = f * r; if (fr > 17000) continue; const tau = dur * .3 * dm + .03;
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] += a * Math.sin(TAU * fr * t) * Math.exp(-t / tau); }
  }
  for (let i = 0; i < 160 && i < n; i++) o[i] += (rnd() * 2 - 1) * .1 * Math.exp(-i / 30);
  for (let i = 0; i < 40 && i < n; i++) o[i] *= i / 40;
  return scale(o, vel * .5);
}
function mallet(f, dur = .35, vel = 1, bend = 0) {
  const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0, ph4 = 0, ph10 = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, fr = f * (1 + bend * Math.exp(-t / .04)); ph += TAU * fr / SR; ph4 += TAU * fr * 4 / SR; ph10 += TAU * fr * 9.8 / SR;
    o[i] = Math.sin(ph) * Math.exp(-t / (dur * .35)) + .28 * Math.sin(ph4) * Math.exp(-t / (dur * .1)) + .12 * Math.sin(ph10) * Math.exp(-t / (dur * .04)); }
  for (let i = 0; i < 30 && i < n; i++) o[i] *= i / 30;
  return scale(o, vel * .6);
}
function pad(freqs, dur, { attack = .5, release = .6, harm = 10, tilt = 1.3, vib = 0, formant = false, vel = 1 } = {}) {
  const n = Math.ceil(dur * SR), o = new Float32Array(n);
  for (const f of freqs) for (const det of [-.0035, .0035]) {
    for (let k = 1; k <= harm; k++) {
      const fk = f * (1 + det) * k; if (fk > 9000) break;
      let a = 1 / Math.pow(k, tilt);
      if (formant) a *= .15 + Math.exp(-Math.pow((fk - 700) / 220, 2)) + .6 * Math.exp(-Math.pow((fk - 1150) / 260, 2));
      let ph = rnd() * TAU; const w = TAU * fk / SR;
      for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release); ph += w * (1 + (vib ? vib * Math.sin(TAU * 5.4 * t) : 0)); o[i] += a * env * Math.sin(ph); }
    }
  }
  return scale(o, vel * .09 / Math.sqrt(freqs.length));
}
function brass(f, dur, vel = 1) {
  const n = Math.ceil(dur * SR), o = new Float32Array(n);
  for (const det of [-.004, 0, .004]) for (let k = 1; k <= 18; k++) {
    const fk = f * (1 + det) * k; if (fk > 9000) break; let ph = rnd() * TAU; const w = TAU * fk / SR;
    for (let i = 0; i < n; i++) { const t = i / SR, open = Math.min(1, .25 + t / .09), env = Math.min(1, t / .025) * Math.exp(-t / (dur * 1.6)) * Math.min(1, (dur - t) / .08), a = Math.exp(-k / (3 + 14 * open * open)) / k * 1.4; ph += w; o[i] += a * env * Math.sin(ph); }
  }
  return scale(o, vel * .12);
}
function noise(sec) { const o = buf(sec); for (let i = 0; i < o.length; i++) o[i] = rnd() * 2 - 1; return o; }
function bandpass(x, fcFn, Q = 1.2) { const y = new Float32Array(x.length); let lo = 0, bd = 0; const q = 1 / Q;
  for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(fcFn(i / SR), 7000) / SR); lo += f * bd; const hi = x[i] - lo - q * bd; bd += f * hi; y[i] = bd; } return y; }
function lowpass(x, fc) { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; return x.map(v => (y += a * (v - y))); }
function highpass(x, fc) { const lp = lowpass(x, fc); return x.map((v, i) => v - lp[i]); }
function whoosh(dur, f0, f1, vel = 1) { const n = noise(dur), len = n.length, o = bandpass(n, t => f0 * Math.pow(f1 / f0, t / dur), 1.1);
  for (let i = 0; i < len; i++) { const t = i / len, env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 1.6) * (f1 > f0 ? Math.pow(t, .6) : Math.pow(1 - t, .6)); o[i] *= env; } return scale(o, vel * 1.3); }
function boom(dur = 1.2, f0 = 38, vel = 1) { const n = Math.ceil(dur * SR), o = new Float32Array(n), nz = lowpass(noise(dur), 380); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (f0 + 95 * Math.exp(-t / .1)) / SR; o[i] = Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t / (dur * .38)) + nz[i] * 2.4 * Math.exp(-t / (dur * .17))); } return scale(o, vel * .8); }
function sparkle(dur, count, vel = 1, base = 2093) { const o = buf(dur + .4), ratios = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4];
  for (let c = 0; c < count; c++) { const t = rnd() * dur, f = base * ratios[Math.floor(rnd() * ratios.length)] * (rnd() < .3 ? 2 : 1), len = Math.round(.22 * SR), p = new Float32Array(len);
    for (let i = 0; i < len; i++) { const tt = i / SR; p[i] = Math.sin(TAU * f * tt) * Math.exp(-tt / .045) * (1 - Math.exp(-tt / .002)); } add(o, p, t, vel * (.25 + rnd() * .5) * (1 - t / (dur * 1.4))); } return o; }
function thud(dur = .22, f0 = 150, vel = 1, crack = .6) { const n = Math.ceil(dur * SR), o = new Float32Array(n), nz = bandpass(noise(dur), t => 1800 * Math.exp(-t * 14) + 500, .9); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (f0 * .45 + f0 * Math.exp(-t / .035)) / SR; o[i] = Math.tanh(1.4 * Math.sin(ph) * Math.exp(-t / (dur * .3)) + crack * nz[i] * Math.exp(-t / (dur * .12)) * 1.6); } return scale(o, vel * .85); }
// Freeverb-style mono reverb
function reverb(x, { room = .84, damp = .25, wet = .25, tail = 1.2 } = {}) {
  const out = new Float32Array(x.length + Math.ceil(tail * SR)); out.set(x);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => ({ b: new Float32Array(d), i: 0, s: 0 })), aps = [556, 441, 341, 225].map(d => ({ b: new Float32Array(d), i: 0 }));
  const y = new Float32Array(out.length);
  for (let n = 0; n < out.length; n++) { const inp = (n < x.length ? x[n] : 0) * .015; let s = 0;
    for (const c of combs) { const v = c.b[c.i]; c.s = v * (1 - damp) + c.s * damp; c.b[c.i] = inp + c.s * room; if (++c.i >= c.b.length) c.i = 0; s += v; }
    for (const a of aps) { const v = a.b[a.i], t = s; s = -s + v; a.b[a.i] = t + v * .5; if (++a.i >= a.b.length) a.i = 0; }
    y[n] = s; }
  for (let n = 0; n < out.length; n++) out[n] = (n < x.length ? x[n] : 0) * (1 - wet * .5) + y[n] * wet * 6;
  return out;
}
const finish = (x, peak = .89) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); const g = p ? peak / p : 1, fo = Math.round(.03 * SR);
  const o = Float32Array.from(x, v => v * g); for (let i = 0; i < fo && i < o.length; i++) o[o.length - 1 - i] *= i / fo; let end = o.length; while (end > 1 && Math.abs(o[end - 1]) < .002) end--; return o.subarray(0, Math.min(o.length, end + Math.round(.03 * SR))); };




// --- 10초 맞추기 효과음 ---
const S = []; const def = (name, fn, kbps = 80) => S.push({ name, fn, kbps });
const env = (x, f) => { for (let i = 0; i < x.length; i++) x[i] *= f(i / SR, i / x.length); return x; };
function beep(f, dur, vel = 1, square = .25) { // 전자 시계 삑: 사인 + 약한 홀수 배음, 딱 끊기지 않게
  const n = Math.ceil(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / .004) * Math.min(1, (dur - t) / .025); o[i] = (Math.sin(TAU * f * t) + square * Math.sin(TAU * f * 3 * t) / 3 + square * Math.sin(TAU * f * 5 * t) / 5) * e; }
  return scale(o, vel * .45);
}
function tick(vel = 1, f = 2600) { // 시계 째깍: 아주 짧은 나무 톡 + 금속 울림
  const o = buf(.05), nz = bandpass(noise(.05), () => f, 4);
  for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] = nz[i] * Math.exp(-t / .004) * 1.8 + Math.sin(TAU * f * 1.6 * t) * Math.exp(-t / .008) * .35; }
  return scale(o, vel * .8);
}
// 3 · 2 · 1(같은 삑, 화면이 높낮이를 바꾼다)
def('tm-count', () => { const o = buf(.3); add(o, beep(N(81), .16, 1)); add(o, bell(N(93), .25, .18, .6), .002); return reverb(o, { wet: .06, tail: .15 }); }, 64);
// 시작: 한 옥타브 위 긴 삑 + 올라가는 반짝임
def('tm-go', () => { const o = buf(.75); add(o, beep(N(93), .32, 1.1)); add(o, beep(N(100), .2, .35, .1), .05); add(o, sparkle(.35, 7, .5, 2637), .04); add(o, whoosh(.25, 900, 5200, .25), 0); return reverb(o, { wet: .12, tail: .35 }); });
// 숫자가 숨을 때: 전원이 내려가듯 떨어지는 삑
def('tm-hide', () => { const n = Math.ceil(.32 * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = N(84) * Math.pow(.42, t / .32); ph += TAU * f / SR; o[i] = (Math.sin(ph) + .2 * Math.sin(3 * ph)) * Math.min(1, t / .005) * Math.pow(1 - t / .32, 1.5) * .4; }
  const x = buf(.45); add(x, o); add(x, highpass(noise(.03), 3000).map((v, i) => v * Math.exp(-i / SR / .006) * .25)); return reverb(x, { wet: .08, tail: .15 }); }, 64);
// 숨김 중 아주 작은 째깍(화면이 1초마다, 설정으로 끈다)
def('tm-tick', () => { const o = buf(.07); add(o, tick(1, 2600)); add(o, tick(.35, 1700), .006); return o; }, 64);
// 버튼 누름: 묵직한 플라스틱 딸깍(누름 쿵 + 스위치 똑)
def('tm-press', () => { const o = buf(.35); add(o, thud(.16, 170, .9, .9)); add(o, highpass(noise(.012), 2500).map((v, i) => v * Math.exp(-i / SR / .0025) * 1.1)); add(o, mallet(N(64), .12, .3, .2), .003); return reverb(o, { wet: .05, tail: .12 }); }, 80);
// 숫자 공개: 띠링(위로 두 음)
def('tm-reveal', () => { const o = buf(1); add(o, bell(N(88), .7, .7, 1.1)); add(o, bell(N(95), .8, .8, 1.1), .09); add(o, sparkle(.25, 5, .25, 3136), .1); return reverb(o, { wet: .16, tail: .4 }); });
// 등급: 완벽(밝은 화음 아르페지오 + 반짝 + 쿵) · 훌륭(짧은 아르페지오) · 좋음(두 음) · 아쉬움(부드럽게 내려가는 두 음, 격려 톤)
def('tm-perfect', () => { const o = buf(2); [72, 76, 79, 84, 88].forEach((m, i) => add(o, bell(N(m), 1.1, .65, 1), i * .055)); add(o, pad([N(60), N(64), N(67), N(72)], 1.5, { attack: .03, release: .9, vel: 1.4 }), .2); add(o, sparkle(1.1, 22, .55, 2093), .25); add(o, boom(.6, 55, .35), .2); return reverb(o, { wet: .24, tail: .8 }); }, 96);
def('tm-great', () => { const o = buf(1.3); [72, 76, 79, 84].forEach((m, i) => add(o, mallet(N(m), .45, .8, .02), i * .06)); add(o, bell(N(91), .7, .3, 1), .24); add(o, sparkle(.5, 8, .3, 2349), .25); return reverb(o, { wet: .18, tail: .5 }); });
def('tm-good', () => { const o = buf(.9); add(o, mallet(N(72), .4, .8)); add(o, mallet(N(79), .5, .85), .11); return reverb(o, { wet: .14, tail: .35 }); }, 64);
def('tm-miss', () => { const o = buf(1); add(o, mallet(N(67), .45, .7, -.03)); add(o, mallet(N(62), .6, .65, -.05), .16); add(o, pad([N(55), N(62)], .6, { attack: .05, release: .4, vel: .7 }), .16); return reverb(o, { wet: .14, tail: .35 }); }, 64);
// 내 기록 갱신: 짧은 금관 팡파르 + 종 + 반짝
def('tm-record', () => { const o = buf(2.2); [[67, 0, .16], [72, .14, .16], [76, .28, .16], [79, .42, .9]].forEach(([m, t, d]) => add(o, brass(N(m), d, .9), t)); add(o, brass(N(64), .9, .45), .42); add(o, bell(N(91), 1, .45, 1.2), .44); add(o, sparkle(1.1, 18, .4, 2349), .45); add(o, boom(.5, 60, .3), .42); return reverb(o, { wet: .22, tail: .8 }); }, 96);

// --- render & encode ---
const out = process.argv[2]; mkdirSync(out, { recursive: true }); let total = 0;
for (const { name, fn, kbps } of S) {
  seed = 7654321 + name.length * 131;
  const raw = fn(); let nan = 0; for (const v of raw) if (!Number.isFinite(v)) nan++;
  const x = finish(raw);
  let ss = 0; for (const v of x) ss += v * v; const rms = Math.sqrt(ss / x.length);
  const pcm = new Int16Array(x.length); for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, kbps), parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const t = enc.flush(); if (t.length) parts.push(Buffer.from(t));
  const b = Buffer.concat(parts); writeFileSync(join(out, name + '.mp3'), b); total += b.length;
  console.log(name.padEnd(13), (x.length / SR).toFixed(2) + 's', 'rms', (20 * Math.log10(rms)).toFixed(1) + 'dB', 'nan', nan, Math.round(b.length / 1024) + 'KB');
}
console.log(S.length, 'sounds', Math.round(total / 1024), 'KB');
