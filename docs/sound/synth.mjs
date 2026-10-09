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

// --- sounds ---
const S = []; const def = (cat, name, fn, kbps = 128) => S.push({ cat, name, fn, kbps });
// 정답 (한 번 만들고 앱이 콤보마다 높낮이를 올린다)
def('answer-correct', 'correct_bell', () => { const o = buf(1.1); add(o, bell(N(88), .7, 1, 1.2)); add(o, bell(N(95), .8, .85, 1.1), .075); add(o, sparkle(.35, 6, .35), .05); return reverb(o, { wet: .16, tail: .5 }); });
def('answer-correct', 'correct_marimba', () => { const o = buf(.9); add(o, mallet(N(76), .3, 1)); add(o, mallet(N(83), .45, .9), .08); add(o, bell(N(100), .5, .35, 1.3), .08); return reverb(o, { wet: .12, tail: .4 }); });
def('answer-correct', 'correct_chime', () => { const o = buf(1.2); [84, 88, 91].forEach((m, i) => add(o, bell(N(m), .7, .8 - i * .08, 1.2), i * .06)); add(o, sparkle(.5, 9, .4), .1); return reverb(o, { wet: .2, tail: .6 }); });
// 오답
def('answer-wrong', 'wrong_soft', () => { const o = buf(.8); add(o, mallet(N(55), .35, 1, -.04)); add(o, mallet(N(50), .5, .95, -.05), .13); add(o, lowpass(thud(.18, 90, .5, .1), 700), .13); return reverb(o, { wet: .08, tail: .3 }); });
def('answer-wrong', 'wrong_bonk', () => { const o = buf(.7); add(o, thud(.28, 120, .9, .15)); add(o, mallet(N(48), .45, .7, -.08), .02); return reverb(lowpass(o, 2600), { wet: .06, tail: .25 }); });
// 콤보
def('combo-powerup', 'combo_rise', () => { const o = buf(1.1); [76, 79, 83, 88].forEach((m, i) => add(o, bell(N(m), .55, .85, 1.2), i * .055)); add(o, whoosh(.3, 600, 5000, .35), 0); add(o, sparkle(.45, 8, .4), .18); return reverb(o, { wet: .16, tail: .5 }); });
def('combo-powerup', 'combo_zing', () => { const o = buf(.9); add(o, whoosh(.35, 400, 6500, .5)); add(o, bell(N(96), .6, .9, 1.4), .3); add(o, sparkle(.4, 7, .5), .28); return reverb(o, { wet: .14, tail: .4 }); });
def('timer-tick', 'tick_wood', () => mallet(N(84), .09, 1));
def('timer-tick', 'tick_soft', () => lowpass(thud(.07, 420, .8, .05), 3000));
def('ui-tap', 'tap_pop', () => { const o = buf(.12); for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] = Math.sin(TAU * (760 - 420 * Math.min(1, t / .05)) * t) * Math.exp(-t / .03); } return lowpass(o, 4200); });
def('ui-tap', 'tap_glass', () => { const o = buf(.3); add(o, bell(N(96), .22, .7, .8)); return o; });
// 코인
def('coin-reward', 'coin_ding', () => { const o = buf(1); add(o, bell(N(95), .35, 1, 1.5)); add(o, bell(N(100), .8, 1, 1.4), .075); add(o, sparkle(.3, 5, .3, 3136), .08); return reverb(o, { wet: .14, tail: .4 }); });
def('coin-reward', 'coin_shower', () => { const o = buf(1.4); for (let i = 0; i < 9; i++) add(o, bell(N(93 + (i % 3) * 2 + Math.floor(rnd() * 2)), .3, .55 + rnd() * .35, 1.5), i * .06 + rnd() * .02); add(o, sparkle(.8, 8, .35, 3136), .1); return reverb(o, { wet: .14, tail: .5 }); });
// 알 뽑기
def('egg-wiggle', 'wiggle_tok', () => reverb(mallet(N(52), .16, 1, .05), { wet: .06, tail: .25 }));
def('egg-wiggle', 'wiggle_pon', () => reverb(mallet(N(60), .22, .9, .1), { wet: .08, tail: .3 }));
def('egg-crack', 'crack_glass', () => { const o = buf(.45); add(o, lowpass(highpass(noise(.05), 3500).map((v, i) => v * Math.exp(-i / SR / .012)), 9000), 0, 1.4); add(o, bell(N(100), .3, .5, 1.6), .005); add(o, thud(.1, 220, .4, .2), 0); return reverb(o, { wet: .1, tail: .3 }); });
def('egg-crack', 'crack_ice', () => { const o = buf(.5); for (let k = 0; k < 4; k++) add(o, highpass(noise(.03), 4500).map((v, i) => v * Math.exp(-i / SR / .008)), k * .022 + rnd() * .01, 1.1); add(o, bell(N(103), .35, .45, 1.8), .02); return reverb(o, { wet: .1, tail: .3 }); });
def('egg-burst', 'burst_magic', () => { const o = buf(2.4); add(o, whoosh(.5, 300, 7000, .8)); add(o, boom(1.2, 42, .9), .5); add(o, sparkle(1.2, 22, .6), .5); add(o, bell(N(96), 1.2, .5, 1.3), .52); return reverb(o, { wet: .22, tail: 1 }); }, 160);
def('egg-burst', 'burst_pop', () => { const o = buf(1.6); add(o, thud(.3, 170, .9, .7)); add(o, whoosh(.25, 1200, 8000, .5), .02); add(o, sparkle(.9, 16, .55), .04); add(o, bell(N(100), .8, .5, 1.4), .05); return reverb(o, { wet: .18, tail: .7 }); }, 160);
// 팡파르 (jingle-win 맨 앞 5개: 기본, 영웅, 전설, 신화, 클리어)
const arp = (o, notes, gap, t0 = 0, vel = .85, dur = .9) => notes.forEach((m, i) => { add(o, bell(N(m), dur, vel, 1.2), t0 + i * gap); add(o, mallet(N(m - 12), .3, .5), t0 + i * gap); });
def('jingle-win', 'fanfare_basic', () => { const o = buf(2.2); arp(o, [72, 76, 79, 84], .1); add(o, pad([N(60), N(64), N(67), N(72)], 1.4, { attack: .12, release: .8, vel: .8 }), .22); add(o, sparkle(.9, 10, .45), .35); return reverb(o, { wet: .22, tail: .8 }); }, 160);
def('jingle-win', 'fanfare_epic', () => { const o = buf(3); arp(o, [72, 76, 79, 84, 88], .095); add(o, pad([N(55), N(60), N(64), N(67), N(76)], 2.1, { attack: .2, release: 1, vel: 1 }), .2); add(o, brass(N(60), .55, .6), .4); add(o, whoosh(.5, 500, 6000, .4), 0); add(o, sparkle(1.4, 18, .5), .4); return reverb(o, { wet: .24, tail: 1 }); }, 160);
def('jingle-win', 'fanfare_legend', () => { const o = buf(4.4); add(o, whoosh(.7, 250, 6500, .7)); add(o, boom(1.4, 45, .8), .65); arp(o, [67, 72, 76, 79, 84, 88, 91, 96], .085, .35, .8, 1.1); add(o, pad([N(48), N(55), N(60), N(64), N(71), N(74)], 3, { attack: .25, release: 1.4, vel: 1.1 }), .6); add(o, brass(N(60), .8, .8), .65); add(o, brass(N(67), .8, .6), .65); add(o, sparkle(2, 30, .6), .65); return reverb(o, { wet: .28, tail: 1.6 }); }, 192);
def('jingle-win', 'fanfare_mythic', () => { const o = buf(7); add(o, boom(2.2, 34, 1), 0); add(o, pad([N(36), N(43)], 4, { attack: 1, release: 1.4, harm: 8, vel: 1 }), 0); add(o, whoosh(1.4, 200, 7500, .9), .3);
  add(o, pad([N(48), N(55), N(60), N(64), N(67)], 4.6, { attack: 1.1, release: 1.6, formant: true, vib: .004, harm: 14, vel: 1.6 }), .9);
  arp(o, [72, 76, 79, 83, 84, 88, 91, 95, 96, 100], .075, 1.3, .85, 1.4); add(o, boom(2, 40, 1), 1.75); add(o, brass(N(60), 1.2, .9), 1.75); add(o, brass(N(67), 1.2, .7), 1.75); add(o, brass(N(72), 1.2, .6), 1.75);
  add(o, sparkle(3.2, 55, .7), 1.75); add(o, bell(N(96), 2.2, .6, 1.3), 1.78); return reverb(o, { room: .9, wet: .32, tail: 2.6 }); }, 192);
def('jingle-win', 'fanfare_clear', () => { const o = buf(3.2); [[60, 0], [67, .16], [72, .32], [76, .48]].forEach(([m, t]) => { add(o, brass(N(m), .3, .8), t); add(o, bell(N(m + 12), .6, .5), t); }); add(o, brass(N(72), 1.1, .9), .7); add(o, brass(N(76), 1.1, .7), .7); add(o, brass(N(79), 1.1, .7), .7); add(o, pad([N(48), N(55), N(64)], 1.8, { attack: .08, release: 1, vel: .9 }), .7); add(o, sparkle(1.2, 14, .5), .72); return reverb(o, { wet: .2, tail: 1 }); }, 160);
// 짧은 팡파르 / 실패
def('jingle-small', 'small_levelup', () => { const o = buf(1.6); arp(o, [72, 76, 79, 84, 88], .07, 0, .8, .7); add(o, sparkle(.7, 10, .45), .25); add(o, pad([N(60), N(67), N(72)], .9, { attack: .05, release: .5, vel: .7 }), .3); return reverb(o, { wet: .18, tail: .6 }); });
def('jingle-small', 'fail_sigh', () => { const o = buf(2.4); [[64, 0], [60, .22], [57, .44], [52, .7]].forEach(([m, t], i) => add(o, mallet(N(m), .7, .85 - i * .1, -.01), t)); add(o, pad([N(45), N(52), N(57)], 1.8, { attack: .2, release: 1, vel: .6 }), .5); return reverb(lowpass(o, 3200), { wet: .16, tail: .8 }); });
// 전투·던전
def('hit-light', 'hit_snap', () => reverb(thud(.2, 170, 1, .8), { wet: .05, tail: .25 }));
def('hit-light', 'hit_slash', () => { const o = buf(.45); add(o, whoosh(.14, 2500, 9000, .6)); add(o, thud(.18, 190, .9, .9), .09); return reverb(o, { wet: .06, tail: .25 }); });
def('hit-heavy', 'hit_smash', () => { const o = buf(1); add(o, thud(.35, 110, 1, .9)); add(o, boom(.8, 50, .7), .02); add(o, sparkle(.3, 5, .3, 3136), .03); return reverb(o, { wet: .12, tail: .5 }); });
def('hurt-soft', 'hurt_oof', () => { const o = buf(.6); add(o, thud(.3, 95, 1, .2)); add(o, lowpass(mallet(N(45), .4, .7, -.1), 900), .02); return reverb(o, { wet: .08, tail: .3 }); });
def('skill-magic', 'skill_cast', () => { const o = buf(1.5); add(o, whoosh(.55, 400, 6500, .7)); add(o, bell(N(91), 1, .7, 1.3), .5); add(o, sparkle(.9, 18, .5), .5); add(o, boom(.6, 60, .5), .5); return reverb(o, { wet: .2, tail: .8 }); }, 160);
def('skill-magic', 'skill_flame', () => { const o = buf(1.4); add(o, whoosh(.6, 1500, 400, .8), 0); add(o, lowpass(noise(.5), 1400).map((v, i) => v * Math.exp(-i / SR / .25) * 1.2), .15); add(o, thud(.3, 100, .8, .5), .1); return reverb(o, { wet: .14, tail: .6 }); });
def('boss-appear', 'boss_enter', () => { const o = buf(4); add(o, pad([N(31), N(38), N(43)], 3.6, { attack: 1.2, release: 1.4, harm: 9, vel: 1.6 }), 0); add(o, whoosh(1.6, 150, 3000, .7), .6); add(o, boom(2, 32, 1), 1.6); add(o, brass(N(36), 1.4, .8), 1.62); add(o, sparkle(1.2, 10, .3, 1568), 1.7); return reverb(o, { room: .9, wet: .3, tail: 1.5 }); }, 192);

// --- render & encode ---
const out = process.argv[2], manifest = [];
for (const { cat, name, fn, kbps } of S) {
  seed = 1234567 + name.length * 977;
  const raw = fn(); let rawPeak = 0, nan = 0; for (const v of raw) { if (!Number.isFinite(v)) nan++; else rawPeak = Math.max(rawPeak, Math.abs(v)); }
  const x = finish(raw); // STATS
  { let ss = 0, zc = 0, clip = 0; for (let i = 0; i < x.length; i++) { ss += x[i] * x[i]; if (i && (x[i] >= 0) !== (x[i - 1] >= 0)) zc++; if (Math.abs(x[i]) > .88) clip++; } const rms = Math.sqrt(ss / x.length); console.log(`${cat.padEnd(15)} ${name.padEnd(16)} ${(x.length / SR).toFixed(2)}s rms ${(20 * Math.log10(rms)).toFixed(1)}dB crest ${(.89 / rms).toFixed(1)} zcHz ${Math.round(zc / 2 / (x.length / SR))} rawPeak ${rawPeak.toFixed(2)} nan ${nan}`); }
  const pcm = new Int16Array(x.length); for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, kbps), parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const t = enc.flush(); if (t.length) parts.push(Buffer.from(t));
  const b = Buffer.concat(parts); mkdirSync(join(out, cat), { recursive: true }); writeFileSync(join(out, cat, `synth__${name}.mp3`), b);
  manifest.push({ cat, name: `synth__${name}`, source: 'synth', sec: +(x.length / SR).toFixed(2), bytes: b.length });
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(manifest.length, 'sounds', Math.round(manifest.reduce((a, m) => a + m.bytes, 0) / 1024), 'KB');
