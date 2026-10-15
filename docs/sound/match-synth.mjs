// V13.149 짝 맞추기 고퀄 효과음 3개(카드 뒤집기 · 날아가기 · 도장). battle-synth.mjs의 악기를 그대로 쓴다.
// 사용: (npm i @breezystack/lamejs 뒤) node docs/sound/match-synth.mjs <출력 폴더> → <key>.mp3 를 public/assets/sfx/에 넣는다.
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
def('card-flip', () => { const o = buf(.22); add(o, highpass(whoosh(.09, 2500, 6000, .5), 1500)); add(o, highpass(noise(.01), 4000).map((v, i) => v * Math.exp(-i / SR / .002) * .6), .07); add(o, mallet(N(86), .07, .35, .05), .07); return o; }, 96);
def('swoosh', () => { const o = buf(.45); add(o, whoosh(.32, 600, 5200, .85)); add(o, bell(N(96), .2, .18, 1.2), .26); return reverb(o, { wet: .08, tail: .2 }); }, 96);
def('stamp', () => { const o = buf(.9); add(o, thud(.3, 110, 1, 1)); add(o, boom(.5, 60, .5), .005); add(o, highpass(noise(.05), 1800).map((v, i) => v * Math.exp(-i / SR / .012) * .7)); add(o, bell(N(88), .5, .3, 1), .03); return reverb(o, { wet: .14, tail: .45 }); }, 96);

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
