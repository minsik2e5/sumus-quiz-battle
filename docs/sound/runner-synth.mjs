// 펫 대행진(크라우드 러너) 효과음 16개(rn-*). 악기는 arena-synth.mjs(← battle-synth.mjs)의 것을 그대로 옮겨 겹쳐 만든다(녹음 없음).
// 사용: (npm i --no-save @breezystack/lamejs 뒤) node docs/sound/runner-synth.mjs public/assets/sfx
// 느낌: 밝고 박진감 있는 모바일 게임 소리. 다른 게임의 소리를 따라 하지 않고 이 파일의 식으로만 만든다.
// 용량: 전체 효과음 상한(sound-check의 2.7MB)을 넘지 않게 짧게 · 낮은 비트레이트(40~48kbps 모노)로 굽는다(합계 약 90KB).
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

// --- 펫 대행진 효과음 ---
// 사건 이름(public/modules/runner-sfx.js의 RUNNER_SFX)과 같은 이름: rn-<사건>.
// 좋은 문: 위로 튀는 네 음(도 · 미 · 솔 · 도) + 반짝. "반짝 상승"
def('rn-gate-good', () => { const o = buf(.9);
  [84, 88, 91, 96].forEach((m, i) => { add(o, mallet(N(m), .28, .75 - i * .05, .02), i * .045); add(o, bell(N(m + 12), .35, .22), i * .045); });
  add(o, sparkle(.3, 9, .45, 3136), .12); return reverb(o, { wet: .14, tail: .25 }); }, 48);
// 나쁜 문: "뿅" 하고 아래로 미끄러지는 동그란 소리(장난스럽게, 무섭지 않게)
def('rn-gate-bad', () => { const o = buf(.6), d = .34; let ph = 0, ph2 = 0;
  const b = new Float32Array(Math.ceil(d * SR));
  for (let i = 0; i < b.length; i++) { const t = i / SR, f = 620 * Math.pow(170 / 620, Math.pow(t / d, .8)) * (1 + .04 * Math.sin(TAU * 26 * t)); ph += TAU * f / SR; ph2 += TAU * f * 2 / SR;
    b[i] = (Math.sin(ph) + .25 * Math.sin(ph2)) * Math.min(1, t / .006) * Math.min(1, (d - t) / .06); }
  add(o, b, 0, .8); add(o, blip(900, 500, .05, .3)); return o; }, 48);
// ×문: 정령이 와르르 불어나는 소리(작은 퐁 18개가 점점 높아지며 빨라짐) + 끝 반짝
def('rn-multiply', () => { const o = buf(1.1); let t = 0;
  for (let k = 0; k < 18; k++) { const f = 480 * Math.pow(2, k / 10) * (1 + (rnd() - .5) * .08); add(o, blip(f * .7, f * 1.6, .045, .55 + rnd() * .2), t); t += .055 * Math.pow(.93, k); }
  [88, 91, 96].forEach((m, i) => add(o, bell(N(m), .45, .35), t + i * .03)); add(o, sparkle(.25, 6, .3, 2637), t);
  return reverb(o, { wet: .12, tail: .25 }); }, 48);
// 사격: 아주 짧고 경쾌한 "퓻"(되풀이돼도 귀가 아프지 않게 부드러운 사인 + 작은 톡)
def('rn-shoot', () => { const o = buf(.12); add(o, blip(1700, 760, .055, .8)); add(o, snap(.02, 3500, .004, .25)); return o; }, 48);
// 바위 맞음: 짧은 딱(돌) + 작은 쿵
def('rn-rock-hit', () => { const o = buf(.22); add(o, thud(.14, 210, .8, .9)); add(o, snap(.03, 2500, .006, .4)); return o; }, 48);
// 바위 깨짐: 쩍(금) + 쿵 + 파편이 우수수
def('rn-rock-break', () => { const o = buf(1); add(o, snap(.05, 1800, .012, 1)); add(o, thud(.3, 140, 1, 1)); add(o, sub(.25, 60, .6));
  for (let k = 0; k < 14; k++) { const t = .05 + rnd() * .45, f = 900 + rnd() * 2600; add(o, bandpass(noise(.03), () => f, 6).map((v, i) => v * Math.exp(-i / SR / .006)), t, .9 * (1 - t)); }
  return reverb(o, { wet: .1, tail: .2 }); }, 48);
// 톱날: "위이잉" 금속 회전(톱니파 + 떨림 + 대역 필터가 올라갔다 내려옴)
def('rn-saw', () => { const d = .55, o = buf(d + .3); const s = saw(680, 760, d, 1, .012);
  for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] *= (.75 + .25 * Math.sin(TAU * 38 * t)) * Math.min(1, t / .03) * Math.min(1, (d - t) / .12); }
  add(o, bandpass(s, t => 1400 + 900 * Math.sin(Math.PI * t / d), 2.5), 0, 1.3); add(o, highpass(noise(d), 5000).map((v, i) => v * .12 * Math.min(1, (d - i / SR) / .1)));
  return o; }, 48);
// 망치: 묵직한 "쿵"(나무 · 쇠 느낌 약간)
def('rn-hammer', () => { const o = buf(.8); add(o, thud(.4, 95, 1, .7)); add(o, sub(.45, 44, 1)); add(o, clang(310, .25, .25), .005); add(o, lowpass(noise(.2), 600).map((v, i) => v * Math.exp(-i / SR / .05)), .01, .8);
  return o; }, 48);
// 펫 구출: 짧은 팡파르(금관 솔-도-미-솔 + 종 + 반짝). 밝고 씩씩하게
def('rn-rescue', () => { const o = buf(1.9);
  [[67, 0, .12], [72, .11, .12], [76, .22, .12], [79, .33, .7]].forEach(([m, t, d]) => { add(o, brass(N(m), d + .1, .9), t); add(o, brass(N(m - 12), d + .1, .45), t); });
  [[79, .33], [84, .33], [88, .36], [91, .39]].forEach(([m, t]) => add(o, bell(N(m), .9, .3), t));
  add(o, sparkle(.6, 14, .4, 2349), .35); add(o, thud(.2, 120, .5, .5), .33);
  return reverb(o, { wet: .2, tail: .45 }); }, 40);
// 카드: 휙 올라오는 바람 + 맑은 딩(고를 때는 runner-sfx.js가 높여 낸다)
def('rn-card', () => { const o = buf(.75); add(o, whoosh(.2, 900, 5000, .5)); add(o, bell(N(91), .5, .55), .16); add(o, mallet(N(79), .2, .35), .16);
  return reverb(o, { wet: .14, tail: .25 }); }, 48);
// 대포: 짧은 "둥"(연사용이라 꼬리가 짧다)
def('rn-cannon', () => { const o = buf(.4); add(o, boom(.28, 46, .9)); add(o, snap(.04, 1200, .01, .5)); add(o, sub(.2, 55, .6)); return o; }, 48);
// 성 맞음: 돌벽 "퍽" + 부스러기 조금
def('rn-castle-hit', () => { const o = buf(.4); add(o, thud(.2, 120, .9, .8)); for (let k = 0; k < 5; k++) add(o, bandpass(noise(.025), () => 700 + rnd() * 1500, 5).map((v, i) => v * Math.exp(-i / SR / .006)), .03 + rnd() * .15, .6);
  return o; }, 48);
// 성 무너짐(크게): 쾅 → 우르르(무너지는 돌) → 파편 → 끝에 밝은 승리 화음 살짝
def('rn-castle-fall', () => { const o = buf(2.6); add(o, snap(.12, 1500, .03, 1)); add(o, boom(1.6, 32, 1.3)); add(o, sub(.6, 40, 1));
  const r = lowpass(noise(1.5), 420); for (let i = 0; i < r.length; i++) { const t = i / SR; r[i] *= Math.min(1, t / .2) * Math.exp(-t / .55) * (.7 + .3 * Math.sin(TAU * 9 * t + 3 * Math.sin(TAU * 2 * t))); } add(o, r, .15, 2.2);
  for (let k = 0; k < 22; k++) { const t = .15 + rnd() * 1.1, f = 400 + rnd() * 1800; add(o, thud(.08, 160 + rnd() * 200, .35, 1).map((v, i) => v * .5), t, .7 * (1.3 - t)); add(o, bandpass(noise(.03), () => f, 5).map((v, i) => v * Math.exp(-i / SR / .008)), t, .5); }
  [72, 76, 79, 84].forEach((m, i) => add(o, bell(N(m), 1, .14), .9 + i * .04));
  return reverb(o, { wet: .2, tail: .6 }); }, 40);
// 별 하나: 맑은 "띵"(1 · 2 · 3번째 별은 runner-sfx.js가 한 음씩 높여 낸다)
def('rn-star', () => { const o = buf(1); add(o, bell(N(88), .8, .9, 1.1)); add(o, bell(N(95), .6, .35), .02); add(o, sparkle(.25, 7, .35, 3520), .03);
  return reverb(o, { wet: .16, tail: .3 }); }, 48);
// 아깝게 짐: 내려가는 세 음 뒤에 "다시 해 볼까?" 하듯 짧게 올라가는 끝음(너무 우울하지 않게)
def('rn-fail', () => { const o = buf(1.4);
  [[76, 0], [74, .16], [71, .32]].forEach(([m, t]) => { add(o, mallet(N(m), .3, .7), t); add(o, mallet(N(m - 12), .3, .3), t); });
  add(o, mallet(N(72), .25, .55, .03), .58); add(o, mallet(N(79), .45, .6, .03), .7); add(o, bell(N(91), .5, .15), .7);
  return reverb(o, { wet: .16, tail: .3 }); }, 40);
// 출발 카운트: 삑 · 삑 · 삑(0.5초 간격) → 1.5초에 "출발!" 높은 화음 + 휙
def('rn-start', () => { const o = buf(2.3);
  [0, .5, 1].forEach(t => { add(o, beep(N(76), .12, .8), t); add(o, mallet(N(76), .15, .25), t); });
  [84, 88, 91, 96].forEach(m => add(o, beep(N(m), .35, .45), 1.5)); add(o, bell(N(96), .6, .4), 1.5); add(o, whoosh(.35, 1200, 6000, .45), 1.42);
  return reverb(o, { wet: .12, tail: .3 }); }, 40);

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
