// V13.130 던전 전투 효과음 23개. docs/sound/synth.mjs의 악기(앞부분)를 그대로 쓰고 겹쳐 만든다.
// 사용: (npm i @breezystack/lamejs 뒤) node docs/sound/battle-synth.mjs <출력 폴더> → <key>.mp3 를 public/assets/sfx/에 넣는다.
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


// --- 던전 전투 효과음 (synth-head의 악기를 겹쳐 만든다) ---
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

// 펫 공격 발사
def('atk-star', () => { const o = buf(1); add(o, whoosh(.32, 900, 8000, .55)); add(o, bell(N(98), .5, .55, 1.4), .02); add(o, bell(N(103), .5, .4, 1.4), .07); add(o, sparkle(.4, 10, .45, 2637), .03); return reverb(o, { wet: .14, tail: .5 }); });
def('atk-leaf', () => { const o = buf(.8); [0, .07, .14, .21].forEach((t, i) => { add(o, pluck(N(79 + i * 3), .22, .8), t); add(o, highpass(whoosh(.12, 1500, 4500, .25), 900), t); }); return reverb(o, { wet: .1, tail: .3 }); });
def('atk-wind', () => { const o = buf(1); const nz = noise(.6), w = bandpass(nz, t => 500 + 3000 * Math.sin(Math.PI * Math.min(1, t / .55)), 3.5); env(w, (t) => Math.sin(Math.PI * Math.min(1, t / .6)) ** 1.4); add(o, scale(w, 1.4)); add(o, whoosh(.45, 3000, 700, .5), .05); add(o, bell(N(91), .4, .25, .6), .25); return reverb(o, { wet: .2, tail: .5 }); });
// 맞힘
def('hit-star', () => { const o = buf(1); add(o, thud(.22, 180, 1, .9)); add(o, bell(N(100), .35, .5, 1.8), .005); add(o, highpass(noise(.06), 5000).map((v, i) => v * Math.exp(-i / SR / .015)), 0, .8); add(o, sparkle(.25, 7, .4, 3136), .01); return reverb(o, { wet: .1, tail: .35 }); });
def('hit-leaf', () => { const o = buf(.7); add(o, thud(.2, 150, 1, .6)); add(o, mallet(N(72), .25, .55, .2), .005); add(o, highpass(noise(.08), 2500).map((v, i) => v * Math.exp(-i / SR / .025)), 0, .5); return reverb(o, { wet: .08, tail: .3 }); });
def('hit-wind', () => { const o = buf(.8); add(o, whoosh(.18, 5000, 900, .7)); add(o, thud(.2, 160, .85, .7), .1); add(o, bell(N(96), .3, .25, .8), .11); return reverb(o, { wet: .12, tail: .35 }); });
def('dmg-tick', () => { const o = buf(.18); add(o, bell(N(100), .12, .7, .6)); add(o, mallet(N(88), .08, .4)); return o; });
def('crit', () => { const o = buf(1.3); add(o, thud(.3, 120, 1, 1)); add(o, boom(.7, 55, .65), .01); add(o, clang(1400, .55, .55), .01); add(o, whoosh(.12, 3000, 9000, .4)); add(o, sparkle(.4, 10, .5, 3136), .03); return reverb(o, { wet: .14, tail: .6 }); }, 160);
// 보스 내려찍기
def('boss-charge', () => { const d = 3.2, o = buf(d + .3); add(o, pad([N(29), N(36), N(41)], d, { attack: 1.4, release: .2, harm: 12, tilt: 1.1, vel: 1.4 })); const w = whoosh(d, 90, 2600, .6); add(o, w); const r = lowpass(noise(d), 160); env(r, t => (t / d) ** 1.5 * (.6 + .4 * Math.sin(TAU * (6 + 10 * t / d) * t))); add(o, scale(r, 3)); add(o, sparkle(1, 6, .2, 1046), 2.1); return reverb(o, { room: .88, wet: .2, tail: .6 }); }, 160);
def('warn-beep', () => { const o = buf(.4); add(o, beep(N(81), .11, .9)); add(o, beep(N(76), .13, .8), .14); return reverb(o, { wet: .06, tail: .2 }); });
def('boss-slam', () => { const o = buf(2.6); add(o, whoosh(.22, 4000, 400, .6)); add(o, boom(1.8, 30, 1.2), .2); add(o, thud(.45, 90, 1, 1), .2); for (let k = 0; k < 9; k++) add(o, thud(.08, 300 + rnd() * 500, .25 + rnd() * .2, .9), .3 + rnd() * .5); add(o, highpass(noise(.4), 1200).map((v, i) => v * Math.exp(-i / SR / .12)), .2, .6); return reverb(o, { room: .9, wet: .22, tail: 1.2 }); }, 192);
def('shield-block', () => { const o = buf(1.8); add(o, thud(.25, 140, .7, .5)); add(o, clang(620, 1.4, 1)); add(o, clang(930, 1.1, .55), .004); add(o, whoosh(.5, 1200, 7000, .35), .02); add(o, sparkle(.6, 10, .35, 2093), .05); return reverb(o, { room: .86, wet: .2, tail: 1 }); }, 160);
// 합동 필살
def('ult-riser', () => { const o = buf(1.9); add(o, whoosh(1.3, 200, 9000, .8)); add(o, pad([N(57), N(64), N(69), N(76)], 1.5, { attack: 1.1, release: .25, vel: 1.3, formant: true, vib: .004 })); add(o, sparkle(1.2, 22, .35, 2093), .3); add(o, brass(N(57), .45, .8), 1.25); add(o, brass(N(64), .45, .7), 1.25); add(o, brass(N(69), .45, .7), 1.25); return reverb(o, { room: .9, wet: .26, tail: .8 }); }, 192);
def('ult-impact', () => { const o = buf(3.6); add(o, boom(2.6, 28, 1.3)); add(o, thud(.5, 80, 1, 1)); add(o, clang(800, 1.2, .5), .01); add(o, whoosh(.3, 8000, 600, .7)); [48, 55, 60, 64, 67].forEach(m => add(o, brass(N(m), 1.4, .55), .05)); add(o, pad([N(48), N(55), N(64), N(72)], 2.6, { attack: .05, release: 1.6, vel: 1 }), .05); add(o, sparkle(2, 30, .55, 2093), .08); return reverb(o, { room: .92, wet: .3, tail: 1.6 }); }, 192);
// 페이즈 전환
def('boss-roar', () => { const o = buf(3); add(o, growl(1.9, 72, 1), .05); add(o, growl(1.7, 54, .7), .12); add(o, boom(1.6, 34, .8)); add(o, pad([N(26), N(33)], 2.2, { attack: .3, release: 1, harm: 14, tilt: 1, vel: 1.2 }), .1); return reverb(o, { room: .92, wet: .28, tail: 1.2 }); }, 192);
// 영어 쓰기
def('type-key', () => { const o = buf(.12); add(o, mallet(N(91), .07, .7, .1)); add(o, highpass(noise(.012), 3000).map((v, i) => v * Math.exp(-i / SR / .003)), 0, .4); return o; });
def('type-ok', () => { const o = buf(.5); add(o, bell(N(84), .35, .8, 1.1)); add(o, mallet(N(72), .15, .4)); return reverb(o, { wet: .1, tail: .25 }); });
def('type-wrong', () => { const o = buf(.4); add(o, lowpass(beep(N(45), .16, 1), 1400)); add(o, lowpass(beep(N(44), .16, .9), 1400), .02); add(o, thud(.12, 90, .5, .1)); return o; });
def('spell-done', () => { const o = buf(1.8); [72, 76, 79, 84, 88, 91].forEach((m, i) => { add(o, bell(N(m), .6, .75, 1.2), i * .045); add(o, pluck(N(m - 12), .3, .35), i * .045); }); add(o, whoosh(.35, 800, 7000, .35)); add(o, sparkle(.7, 14, .45), .25); add(o, pad([N(60), N(67), N(76)], .9, { attack: .05, release: .6, vel: .7 }), .25); return reverb(o, { wet: .2, tail: .7 }); }, 160);
// 기절 / 부활
def('faint', () => { const o = buf(1.6); [67, 63, 60, 55].forEach((m, i) => add(o, mallet(N(m), .45, .8 - i * .1, -.03), i * .12)); add(o, whoosh(.7, 2400, 200, .4), .05); add(o, thud(.3, 80, .7, .2), .55); return reverb(lowpass(o, 3500), { wet: .14, tail: .6 }); });
def('revive', () => { const o = buf(2); add(o, whoosh(.5, 300, 5000, .4)); [67, 71, 74, 79, 83].forEach((m, i) => add(o, bell(N(m), .9, .7, 1.2), .2 + i * .07)); add(o, pad([N(55), N(62), N(67), N(71)], 1.2, { attack: .3, release: .7, vel: .8, formant: true }), .2); add(o, sparkle(.9, 16, .4), .35); return reverb(o, { room: .88, wet: .26, tail: .9 }); }, 160);
// 콤보 단계 / 처치
def('combo-10', () => { const o = buf(1.2); [76, 79, 83, 88].forEach((m, i) => add(o, bell(N(m), .55, .85, 1.3), i * .05)); add(o, whoosh(.3, 600, 6000, .4)); add(o, clang(1760, .5, .25), .2); add(o, sparkle(.5, 10, .45), .18); return reverb(o, { wet: .16, tail: .5 }); });
def('boss-down', () => { const o = buf(3.4); add(o, growl(1.2, 60, .6)); add(o, thud(.4, 70, 1, .8), 1.0); add(o, boom(2, 26, 1.1), 1.0); for (let k = 0; k < 12; k++) add(o, thud(.09, 250 + rnd() * 600, .2 + rnd() * .2, .9), 1.1 + rnd() * .9); return reverb(o, { room: .92, wet: .26, tail: 1.3 }); }, 192);

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
