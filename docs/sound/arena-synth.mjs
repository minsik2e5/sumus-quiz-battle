// V13.237 펫 아레나 효과음 23개(ar-*). battle-synth.mjs의 악기를 그대로 쓰고 겹쳐 만든다(녹음 없음).
// 사용: (npm i --no-save @breezystack/lamejs 뒤) node docs/sound/arena-synth.mjs public/assets/sfx
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


const S = []; const def = (name, fn, kbps = 128) => S.push({ name, fn, kbps });
const env = (x, f) => { for (let i = 0; i < x.length; i++) x[i] *= f(i / SR, i / x.length); return x; };
function clang(f, dur = 1, vel = 1) { // 금속 방패: 비정수배 배음
  const n = Math.ceil(dur * SR), o = new Float32Array(n);
  for (const [r, a, d] of [[1, 1, .55], [2.41, .7, .4], [3.93, .5, .28], [5.33, .35, .2], [6.87, .22, .12], [8.6, .15, .08]]) {
    const fr = f * r; if (fr > 16000) continue; const ph0 = rnd() * TAU;
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] += a * Math.sin(ph0 + TAU * fr * t) * Math.exp(-t / (dur * d)); }
  }
  for (let i = 0; i < 300 && i < n; i++) o[i] += (rnd() * 2 - 1) * .5 * Math.exp(-i / 60);
  return scale(o, vel * .35);
}
function growl(dur, f0, vel = 1) { // 보스 포효: 흔들리는 톱니파 + 성대 대역
  const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, k = t / dur, f = f0 * (1 + .25 * Math.sin(Math.PI * k)) * (1 + .03 * Math.sin(TAU * 23 * t) + .02 * (rnd() - .5)); ph += f / SR; o[i] = 2 * (ph % 1) - 1; }
  const nz = noise(dur); for (let i = 0; i < n; i++) o[i] = o[i] * .8 + nz[i] * .35;
  const a = bandpass(o, t => 380 + 260 * Math.sin(Math.PI * t / dur), 2.2), b = bandpass(o, () => 1100, 3);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / .12) * Math.min(1, (dur - t) / .5) * (.75 + .25 * Math.sin(TAU * 11 * t)); y[i] = Math.tanh((a[i] * 1.6 + b[i] * .6) * 2.2) * e; }
  return scale(y, vel * .7);
}
function pluck(f, dur = .25, vel = 1) { // 나뭇잎 튕김(카플러스-스트롱)
  const n = Math.ceil(dur * SR), o = new Float32Array(n), L = Math.max(2, Math.round(SR / f)), d = new Float32Array(L);
  for (let i = 0; i < L; i++) d[i] = rnd() * 2 - 1; let j = 0;
  for (let i = 0; i < n; i++) { const nx = (j + 1) % L; const v = (d[j] + d[nx]) * .497; o[i] = d[j]; d[j] = v; j = nx; }
  return scale(o, vel * .6);
}
function beep(f, dur, vel = 1) { const n = Math.ceil(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / .005) * Math.min(1, (dur - t) / .02); o[i] = (Math.sin(TAU * f * t) + .3 * Math.sin(TAU * f * 2 * t) + .15 * Math.sin(TAU * f * 3 * t)) * e; }
  return scale(o, vel * .4); }


// --- 펫 아레나 효과음(V13.237, 계획 docs/arena-battle-reboot-plan.md 6-3 · docs/pet-arena-v2-plan.md 7장) ---
// 짧은 저음(서브): 높이가 훅 떨어지는 사인파. 맞는 소리의 '무게'를 만든다.
function sub(dur, f, vel = 1) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + .9 * Math.exp(-t / .025)) / SR; o[i] = Math.tanh(1.5 * Math.sin(ph)) * Math.exp(-t / (dur * .35)) * Math.min(1, t / .002); } return scale(o, vel * .8); }
const snap = (dur, fc, tau, vel = 1) => scale(highpass(noise(dur), fc).map((v, i) => v * Math.exp(-i / SR / tau)), vel);
const cut = (x, sec, fade = .015) => { const n = Math.min(x.length, Math.round(sec * SR)), o = x.slice(0, n), f = Math.round(fade * SR); for (let i = 0; i < f && i < n; i++) o[n - 1 - i] *= i / f; return o; };
function saw(f0, f1, dur, vel = 1, det = .006) { const n = Math.ceil(dur * SR), o = new Float32Array(n); const ph = [0, 0, 0];
  for (let i = 0; i < n; i++) { const t = i / SR, f = f0 * Math.pow(f1 / f0, t / dur); [-det, 0, det].forEach((d, k) => { ph[k] = (ph[k] + f * (1 + d) / SR) % 1; o[i] += 2 * ph[k] - 1; }); } return scale(o, vel / 3); }
function blip(f0, f1, dur, vel = 1) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (f0 + (f1 - f0) * Math.min(1, t / dur)) / SR; o[i] = Math.sin(ph) * Math.sin(Math.PI * Math.min(1, t / dur)); } return scale(o, vel); }

// 맞힘 등급 5종. 층 3개: 타격(퍽) · 속성(밝은 기운) · 짧은 저음. 1 스침/틱 → 2 평타 → 3 스킬 → 4 강타(효과 굉장 · 치명) → 5 필살.
const HIT_GRADE = [
  { d: .12, f: 230, v: .55, cr: .5, glow: .25, sf: 92, sv: .3 },
  { d: .18, f: 185, v: .8, cr: .7, glow: .35, sf: 72, sv: .5 },
  { d: .26, f: 150, v: 1, cr: .85, glow: .45, sf: 58, sv: .75 },
  { d: .32, f: 125, v: 1, cr: 1, glow: .55, sf: 50, sv: 1 },
  { d: .42, f: 100, v: 1, cr: 1, glow: .6, sf: 42, sv: 1.15 }
];
HIT_GRADE.forEach((g, i) => def(`ar-hit-${i + 1}`, () => {
  const o = buf(g.d + 1.2);
  add(o, thud(g.d, g.f, g.v, g.cr));                                        // 타격
  add(o, snap(.05, 4000, .01 + i * .004), 0, .5 + i * .1);
  add(o, bell(N(96 + i), .25 + i * .08, g.glow, 1.4), .004);                // 속성(밝은 기운)
  if (i >= 1) add(o, sparkle(.12 + i * .06, 3 + i * 3, .25 + i * .05, 2637), .01);
  if (i >= 3) add(o, clang(1100 - i * 80, .35 + i * .1, .25 + (i - 3) * .15), .006);
  add(o, sub(g.d * 1.3, g.sf, g.sv));                                       // 짧은 저음
  if (i === 4) add(o, boom(.9, 40, .55), .01);
  return reverb(o, { wet: .06 + i * .03, tail: .2 + i * .12 });
}, 96));

// 번개 "찌직-쾅": 지직이는 방전(고음 펄스 + 윙윙 톱니) → 하늘이 갈라지는 쾅.
def('ar-thunder', () => { const o = buf(2.2), z = .26, cr = new Float32Array(Math.ceil(z * SR));
  for (let i = 0; i < cr.length; i++) if (rnd() < .012 + .03 * (i / cr.length)) { const L = 20 + Math.floor(rnd() * 90), a = .5 + rnd() * .5; for (let k = 0; k < L && i + k < cr.length; k++) cr[i + k] += (rnd() * 2 - 1) * a * Math.exp(-k / 25); }
  add(o, highpass(cr, 1800), 0, 1.4);
  const bz = saw(118, 150, z, .5); env(bz, (t) => (rnd() < .55 ? 1 : .15) * Math.min(1, t / .02)); add(o, bandpass(bz, () => 2400, 1.5), 0, 1.2);
  add(o, snap(.5, 900, .07, 1.3), z); add(o, boom(1.6, 34, 1.1), z + .01); add(o, thud(.3, 120, 1, 1), z);
  add(o, bell(N(103), .4, .3, 1.8), z);
  return reverb(o, { room: .9, wet: .26, tail: 1 }); }, 96);
// 광선 "웅-" 지속음(약 1초): 겹친 톱니 + 떨림 + 올라가는 휘파람.
def('ar-beam', () => { const d = 1.05, o = buf(d + .4);
  const a = saw(110, 124, d, .7), b = saw(220, 250, d, .35), w = blip(880, 1320, d, .12);
  const s = new Float32Array(a.length); for (let i = 0; i < s.length; i++) s[i] = a[i] + b[i];
  const f = bandpass(s, t => 700 + 500 * Math.sin(TAU * 1.1 * t), 1.4);
  env(f, (t) => Math.min(1, t / .07) * Math.min(1, (d - t) / .25) * (.8 + .2 * Math.sin(TAU * 18 * t)));
  add(o, scale(f, 1.6)); add(o, w); add(o, lowpass(sub(d, 55, .5), 300));
  const nz = bandpass(noise(d), () => 3200, 2); env(nz, t => Math.min(1, t / .05) * Math.min(1, (d - t) / .25)); add(o, nz, 0, .25);
  return reverb(o, { wet: .14, tail: .4 }); }, 96);
// 지진 "쿵-우르르": 큰 쿵 → 떨리며 이어지는 땅울림 + 굴러떨어지는 돌.
def('ar-quake', () => { const o = buf(2.6); add(o, boom(1.4, 30, 1.2)); add(o, thud(.4, 80, 1, .9));
  const r = lowpass(noise(1.9), 140); env(r, (t) => Math.min(1, t / .1) * Math.exp(-t / .9) * (.55 + .45 * Math.sin(TAU * (9 - 3 * t) * t))); add(o, scale(r, 4), .15);
  for (let k = 0; k < 10; k++) add(o, thud(.08, 220 + rnd() * 380, .18 + rnd() * .18, .9), .2 + rnd() * 1.1);
  return reverb(o, { room: .9, wet: .2, tail: .8 }); }, 96);
// 필살 3단 중 1단: 올라가는 소리(1.1초). 끝을 딱 끊는다 → 경기장이 멈춘 1.2초 중 마지막 0.1초가 정적 → 2단(ar-ult-blast)이 터진다.
def('ar-ult-rise', () => { const d = 1.1, o = buf(d + .6);
  add(o, whoosh(d, 180, 9000, .7)); add(o, saw(90, 720, d, .18)); add(o, pad([N(57), N(64), N(69)], d, { attack: .8, release: .02, vel: 1.1, formant: true, vib: .006 }));
  add(o, sparkle(.9, 18, .3, 2093), .15); const r = lowpass(noise(d), 160); env(r, t => (t / d) ** 1.6); add(o, scale(r, 2.5));
  return cut(reverb(o, { wet: .16, tail: .2 }), d, .012); }, 96);
// 필살 3단 중 3단: 폭발.
def('ar-ult-blast', () => { const o = buf(3.4); add(o, snap(.25, 2500, .03, 1)); add(o, boom(2.4, 27, 1.35)); add(o, sub(.7, 38, 1.1)); add(o, thud(.5, 85, 1, 1));
  add(o, clang(760, 1.1, .45), .01); add(o, whoosh(.35, 8000, 500, .7)); [43, 50, 55, 62].forEach(m => add(o, brass(N(m), 1, .5), .04));
  add(o, sparkle(1.6, 26, .45, 2093), .08); for (let k = 0; k < 8; k++) add(o, thud(.08, 300 + rnd() * 500, .2, .9), .25 + rnd() * .7);
  return reverb(o, { room: .92, wet: .28, tail: 1.4 }); }, 96);

// 목록 14개(docs/pet-arena-v2-plan.md 7장).
// 불 뿜기 1.2초 이어지는 화르륵: 너울대는 불길 + 탁탁 튀는 불티.
def('ar-flame-breath', () => { const d = 1.2, o = buf(d + .5);
  const nz = noise(d), fl = bandpass(nz, t => 900 + 500 * Math.sin(TAU * 7 * t) + 300 * Math.sin(TAU * 2.3 * t), .8);
  env(fl, (t) => Math.min(1, t / .06) * Math.min(1, (d - t) / .3) * (.7 + .3 * Math.sin(TAU * 13 * t + 2 * Math.sin(TAU * 3 * t))));
  add(o, scale(fl, 1.6)); const roar = lowpass(noise(d), 260); env(roar, t => Math.min(1, t / .05) * Math.min(1, (d - t) / .3)); add(o, scale(roar, 3));
  for (let k = 0; k < 22; k++) add(o, snap(.02, 2500, .004, .3 + rnd() * .4), .05 + rnd() * (d - .15));
  add(o, whoosh(.3, 600, 4000, .4));
  return reverb(o, { wet: .12, tail: .4 }); }, 96);
// 운석: 휘익(0.55초) + 쾅. 부르는 쪽이 쾅을 떨어지는 때에 맞춘다(쾅은 0.55초 지점).
def('ar-meteor', () => { const o = buf(2.6), z = .55; add(o, whoosh(z + .05, 6000, 500, 1)); add(o, lowpass(saw(500, 120, z, .15), 1200));
  add(o, boom(1.5, 32, 1.2), z); add(o, thud(.35, 100, 1, 1), z); add(o, snap(.3, 1500, .05, .8), z);
  for (let k = 0; k < 9; k++) add(o, thud(.07, 300 + rnd() * 500, .2 + rnd() * .2, .9), z + .05 + rnd() * .6);
  return reverb(o, { room: .9, wet: .22, tail: 1 }); }, 96);
// 물대포 쏴아.
def('ar-water-jet', () => { const d = .75, o = buf(d + .5), h = highpass(noise(d), 1400);
  const b = bandpass(noise(d), t => 1800 + 900 * Math.sin(TAU * 9 * t) * (rnd() * .4 + .8), 1.2);
  env(h, t => Math.min(1, t / .03) * Math.pow(1 - t / d, .7)); env(b, t => Math.min(1, t / .03) * Math.pow(1 - t / d, .9));
  add(o, scale(h, .9)); add(o, scale(b, 1.3)); add(o, thud(.12, 160, .4, .4));
  for (let k = 0; k < 8; k++) add(o, blip(600 + rnd() * 500, 1400 + rnd() * 900, .03, .2), .1 + rnd() * .5);
  return reverb(o, { wet: .14, tail: .4 }); }, 96);
// 방울 깨짐: 퐁 + 물방울 튐.
def('ar-bubble-pop', () => { const o = buf(.8); add(o, blip(380, 1500, .04, .9)); add(o, snap(.03, 3000, .004, .7));
  add(o, bell(N(91), .3, .35, 1.2), .01);
  for (let k = 0; k < 7; k++) add(o, blip(1200 + rnd() * 1400, 2200 + rnd() * 1800, .025, .25), .03 + rnd() * .25);
  return reverb(o, { wet: .14, tail: .35 }); }, 96);
// 덩굴 감김: 쉬익 감기는 소리 + 나무 삐걱 + 튕김.
def('ar-vine', () => { const o = buf(1.2); [0, .12, .24].forEach((t, i) => add(o, whoosh(.2, 700 + i * 300, 3000 + i * 600, .45), t));
  const cr = saw(78, 70, .45, .7); env(cr, (t) => (.6 + .4 * Math.sin(TAU * 31 * t)) * Math.min(1, t / .05) * Math.min(1, (.45 - t) / .1)); add(o, bandpass(cr, () => 950, 3), .25, 1.4);
  [0, .1, .2].forEach((t, i) => add(o, pluck(N(55 + i * 5), .2, .6), t + .03)); add(o, thud(.15, 140, .5, .5), .62);
  return reverb(o, { wet: .1, tail: .35 }); }, 96);
// 바위 구름: 데굴데굴(점점 빨라지는 쿵) + 자갈.
def('ar-rock-roll', () => { const d = 1.1, o = buf(d + .6); let t = 0, gap = .16;
  while (t < d - .1) { add(o, thud(.12, 90 + rnd() * 40, .55 + rnd() * .2, .6), t); t += gap; gap = Math.max(.07, gap * .9); }
  const r = lowpass(noise(d), 180); env(r, x => Math.min(1, x / .1) * Math.min(1, (d - x) / .2)); add(o, scale(r, 3));
  const g = highpass(noise(d), 2500); env(g, x => (rnd() < .08 ? 1 : .1) * Math.min(1, (d - x) / .2)); add(o, g, 0, .35);
  return reverb(o, { wet: .14, tail: .5 }); }, 96);
// 회오리: 휘도는 바람 두 겹.
def('ar-tornado', () => { const d = 1.3, o = buf(d + .6);
  for (const [base, sp, ph] of [[700, 3.2, 0], [1500, 4.6, 1.3]]) { const w = bandpass(noise(d), t => base + base * .8 * Math.sin(TAU * sp * t + ph), 4);
    env(w, t => Math.min(1, t / .2) * Math.min(1, (d - t) / .35)); add(o, scale(w, 2.2)); }
  const lo = lowpass(noise(d), 200); env(lo, t => Math.min(1, t / .2) * Math.min(1, (d - t) / .35) * (.6 + .4 * Math.sin(TAU * 3.2 * t))); add(o, scale(lo, 2));
  return reverb(o, { wet: .2, tail: .6 }); }, 96);
// 얼어붙음 · 쨍: 빠지직 얼어 가다가 맑게 쨍.
def('ar-ice', () => { const o = buf(1.8), z = .3, cr = new Float32Array(Math.ceil(z * SR));
  for (let i = 0; i < cr.length; i++) if (rnd() < .004 + .02 * (i / cr.length)) { for (let k = 0; k < 30 && i + k < cr.length; k++) cr[i + k] += (rnd() * 2 - 1) * Math.exp(-k / 8); }
  add(o, highpass(cr, 3500), 0, 1);
  add(o, clang(2350, 1.1, .8), z); add(o, bell(N(100), .8, .6, 1.6), z); add(o, bell(N(107), .6, .35, 1.6), z + .01); add(o, snap(.05, 5000, .01, .7), z);
  add(o, sparkle(.5, 10, .35, 3520), z + .02);
  return reverb(o, { room: .88, wet: .24, tail: .8 }); }, 96);
// 독구름 보글.
def('ar-poison', () => { const d = .9, o = buf(d + .5);
  for (let k = 0; k < 16; k++) { const f = 160 + rnd() * 260; add(o, blip(f, f * (2 + rnd()), .05 + rnd() * .04, .45 + rnd() * .3), rnd() * (d - .1)); }
  add(o, pad([N(38), N(41)], d, { attack: .15, release: .4, harm: 8, tilt: 1.4, vel: .9 }));
  const m = lowpass(noise(d), 400); env(m, t => Math.min(1, t / .1) * Math.min(1, (d - t) / .3)); add(o, scale(m, 1.4));
  return reverb(lowpass(o, 2600), { wet: .16, tail: .5 }); }, 96);
// 치명타: 날카로운 째짐 + 금속 쨍 + 묵직한 저음.
def('ar-crit', () => { const o = buf(1.4); add(o, snap(.08, 6000, .012, 1)); add(o, thud(.28, 130, 1, 1)); add(o, sub(.35, 52, .9));
  add(o, clang(1800, .6, .55), .004); add(o, clang(2700, .4, .3), .02); add(o, whoosh(.1, 3000, 10000, .35)); add(o, sparkle(.35, 12, .5, 3520), .02);
  return reverb(o, { wet: .14, tail: .5 }); }, 96);
// 히트스톱 무거운 퍽(먹먹한 저음, 울림 없이).
def('ar-hitstop', () => { const o = buf(.5); add(o, lowpass(thud(.32, 70, 1, .8), 900)); add(o, sub(.38, 40, 1.1)); add(o, lowpass(noise(.12), 500).map((v, i) => v * Math.exp(-i / SR / .03)), 0, 1.5); return o; }, 96);
// 초대 받음: 딩-동-딩 + 반짝.
def('ar-invite', () => { const o = buf(1.4); [[79, 0], [84, .13], [88, .26]].forEach(([m, t]) => { add(o, bell(N(m), .7, .8, 1.1), t); add(o, mallet(N(m - 12), .3, .35), t); });
  add(o, sparkle(.5, 10, .35), .3); return reverb(o, { wet: .2, tail: .6 }); }, 96);
// 모두 준비: 올라가는 똑똑똑 + 짧은 금관 화음.
def('ar-ready', () => { const o = buf(1.6); [72, 76, 79].forEach((m, i) => add(o, mallet(N(m), .25, .8), i * .09));
  [60, 67, 72, 76].forEach(m => add(o, brass(N(m), .6, .55), .3)); add(o, sparkle(.4, 10, .35), .32); add(o, thud(.15, 140, .4, .3), .3);
  return reverb(o, { wet: .2, tail: .6 }); }, 96);

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
