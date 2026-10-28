// V13.190 낚시 손맛 더하기 효과음 14개(docs/fishing-feel-design.md): 물고기 몸부림 5 · 낚싯대 단계 5 · 월척 1 · 깊은 바다 3.
// reel-synth.mjs의 악기 · 물 · 줄 · 릴 재료를 그대로 쓰고(아래에 그대로 옮겨 둠), 짧게 만들어 작은 파일(64kbps 안팎)로 낸다.
// 사용: (npm i --no-save @breezystack/lamejs 뒤) node docs/sound/feel-synth.mjs <출력 폴더> → <key>.mp3 를 public/assets/sfx/에 넣는다.
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



// --- 낚시 효과음 (위 악기 + 물 · 줄 · 릴 재료를 겹쳐 만든다) ---
const S = []; const def = (name, fn, kbps = 96) => S.push({ name, fn, kbps });
const env = (x, f) => { for (let i = 0; i < x.length; i++) x[i] *= f(i / SR, i / x.length); return x; };
const norm = (x, p = 1) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return m ? scale(x, p / m) : x; }; // 겹치기 전에 층마다 크기를 맞춘다
function bubble(f0, dur = .06, vel = 1, rise = 1.4) { // 물방울: 거품이 울리며 높아지는 사인(민나르트 공명). 물소리의 알갱이
  const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f0 * (1 + rise * t / dur) / SR; o[i] = Math.sin(ph) * Math.exp(-t / (dur * .3)) * Math.min(1, t / .0008); }
  return scale(o, vel);
}
function water(dur, dens, [lo, hi], vel = 1, size = .03) { // 물 결: 초당 dens(진행 0~1)개의 물방울을 흩뿌린다(낮은 소리일수록 큰 방울 = 길게)
  const o = buf(dur + .3); let t = 0;
  while (t < dur) {
    const d = dens(t / dur); if (d <= 0) { t += .005; continue; }
    t += -Math.log(1 - rnd() * .999) / d; if (t >= dur) break;
    const f = lo * Math.pow(hi / lo, rnd()), s = size * (.5 + rnd()) * Math.sqrt(1000 / f);
    add(o, bubble(f, s, .2 + rnd() * .8, .6 + rnd() * 1.6), t, vel * .35);
  }
  return o;
}
function spray(dur, f0, f1, vel = 1, att = .006, Q = .7) { // 물이 튀는 쏴: 대역을 옮기는 잡음이 확 터졌다 준다
  const o = bandpass(noise(dur), t => f0 * Math.pow(f1 / f0, t / dur), Q);
  return env(o, t => Math.min(1, t / att) * Math.exp(-t / (dur * .28)) * vel);
}
function click(vel = 1, f = 3300) { // 릴 래칫 딸깍: 아주 짧은 금속 톡 두 겹 + 몸통 울림
  const n = Math.ceil(.045 * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.sin(TAU * f * t) * Math.exp(-t / .0035) + .6 * Math.sin(TAU * f * 1.57 * t) * Math.exp(-t / .002) + .5 * Math.sin(TAU * 870 * t) * Math.exp(-t / .007); }
  for (let i = 0; i < 90; i++) o[i] += (rnd() * 2 - 1) * .7 * Math.exp(-i / 18);
  return scale(o, vel * .5);
}
function creak(dur, rateFn, vel = 1, res = [520, 1250, 2650]) { // 끼익: 마찰이 붙었다 미끄러지기(초당 rateFn번)를 낚싯대 · 줄 공명으로 거른다
  const n = Math.ceil(dur * SR), imp = new Float32Array(n); let next = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; if (t >= next) { imp[i] = .6 + rnd() * .4; next = t + (1 + (rnd() - .5) * .18) / rateFn(t / dur); } }
  const o = new Float32Array(n);
  res.forEach((f, j) => { const b = norm(bandpass(imp, t => f * (1 + .03 * Math.sin(TAU * (.7 + j * .4) * t)), 9)); for (let i = 0; i < n; i++) o[i] += b[i] * [1, .7, .45][j]; });
  return scale(o, vel);
}
function sing(dur, f, vel = 1, wob = .008) { // 팽팽한 줄이 우는 소리: 배음 셋 + 느린 떨림
  const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + wob * Math.sin(TAU * 5.3 * t)) / SR; o[i] = Math.sin(ph) + .4 * Math.sin(2 * ph) + .2 * Math.sin(3.01 * ph); }
  return scale(o, vel * .5);
}
function twang(f0, f1, dur, vel = 1) { // 끊긴 줄이 튕기는 피융: 높은 데서 뚝 떨어진다
  const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / (dur * .18)); ph += TAU * f / SR; o[i] = (Math.sin(ph) + .35 * Math.sin(2 * ph) + .15 * Math.sin(3.01 * ph)) * Math.exp(-t / (dur * .3)); }
  return scale(o, vel);
}
function pluck(f, dur = .25, vel = 1) { // 줄 튕김(카플러스-스트롱)
  const n = Math.ceil(dur * SR), o = new Float32Array(n), L = Math.max(2, Math.round(SR / f)), d = new Float32Array(L);
  for (let i = 0; i < L; i++) d[i] = rnd() * 2 - 1; let j = 0;
  for (let i = 0; i < n; i++) { const nx = (j + 1) % L; const v = (d[j] + d[nx]) * .497; o[i] = d[j]; d[j] = v; j = nx; }
  return scale(o, vel * .6);
}
// 이어지는 소리: 한 주기(P초)를 앞뒤가 이어지게 섞고 세 번 이어 붙인다. 앱은 가운데 주기(P~2P초)만 되풀이하므로
// mp3 앞뒤의 빈틈(인코더 지연)이 들리지 않고, 이음매도 없다. 주기는 sound.js의 SOUND_LOOP와 같아야 한다.
const LOOP = .8;
function loopify(x, P) {
  const L = Math.round(P * SR), F = Math.round(.12 * SR), y = new Float32Array(L);
  for (let i = 0; i < L; i++) y[i] = i < F ? x[i] * Math.sqrt(i / F) + x[i + L] * Math.sqrt(1 - i / F) : x[i];
  const o = new Float32Array(L * 3); for (let r = 0; r < 3; r++) o.set(y, r * L); return o;
}


// ── 물고기 몸부림 ──
// 참치 방향 꺾기: 물을 가르는 촥 + 줄이 옆으로 쓸리며 지잉 + 낚싯대 끼익
def('fish-turn', () => { const o = buf(.75);
  add(o, norm(spray(.32, 900, 3200, 1, .004, .7)), 0, .7);
  add(o, norm(env(sing(.4, 300, 1, .02), (t, k) => Math.min(1, t / .01) * (1 - k) ** 2)), .02, .25);
  add(o, norm(creak(.25, k => 120 - k * 50, 1)), .05, .3);
  add(o, norm(water(.3, k => 160 * (1 - k), [600, 2600], 1, .03)), .04, .4);
  return reverb(o, { wet: .08, tail: .25 }); }, 64);
// 먹물 뿜기: 낮게 퓨슉 빨아들였다 뿜는 소리 + 꿀렁 큰 거품 + 어두운 물속 웅
def('fish-ink', () => { const o = buf(1);
  add(o, norm(env(lowpass(noise(.45), 700), (t, k) => Math.min(1, t / .015) * (1 - k) ** 1.6)), 0, .7);
  add(o, norm(bubble(120, .4, 1, 2.6)), .02, .7);
  add(o, norm(water(.5, k => 120 * (1 - k), [250, 1200], 1, .05)), .05, .5);
  add(o, norm(env(sing(.6, 82, 1, .01), (t, k) => Math.sin(Math.PI * k))), 0, .25);
  return reverb(o, { wet: .14, tail: .35 }); }, 56);
// 가오리 미끄러짐: 넓은 날개가 물을 쓸고 지나가는 부드러운 쉬이이익(왼→오른 대역 이동)
def('fish-glide', () => { const o = buf(1.05);
  add(o, norm(env(bandpass(noise(.9), t => 500 + 1400 * Math.sin(Math.PI * t / .9), 1.4), (t, k) => Math.sin(Math.PI * k) ** 1.4)), 0, .8);
  add(o, norm(water(.8, k => 40 * Math.sin(Math.PI * k), [700, 2400], 1, .025)), .05, .35);
  return reverb(o, { wet: .16, tail: .3 }); }, 56);
// 아귀 발광 미끼: 깊은 물속에서 빛이 깜빡이는 신비한 띠링(낮은 종 + 흔들리는 높은 반짝)
def('fish-lure', () => { const o = buf(1);
  add(o, bell(N(76), .8, .6, .7), 0);
  add(o, bell(N(83), .7, .4, .7), .09);
  const s = sparkle(.4, 6, .45, 1760); env(s, t => .6 + .4 * Math.sin(TAU * 7 * t)); add(o, s, .05);
  return reverb(o, { wet: .3, tail: .5 }); }, 56);
// 상어 치고 빠짐: 묵직한 쿵 + 꼬리가 수면을 때리는 촥 + 줄이 확 당겨지는 팅
def('fish-thump', () => { const o = buf(.8);
  add(o, norm(boom(.5, 48)), 0, .9);
  add(o, norm(thud(.18, 110, 1, .6)), 0, .6);
  add(o, norm(spray(.3, 2600, 900, 1, .003, .7)), .02, .45);
  add(o, norm(pluck(110, .4, 1)), .03, .3);
  return reverb(o, { wet: .1, tail: .3 }); }, 64);

// ── 낚싯대 단계 감촉 ──
// 새싹 · 은빛 릴: 가벼운 플라스틱 톡(높고 짧게, 몸통 울림 적게)
def('rod-tick', () => { const o = buf(.05); add(o, click(.9, 4300)); add(o, mallet(N(100), .03, .25, .05), .001); return o; }, 64);
// 보석 · 전설 릴: 묵직한 금속 드르륵(래칫 이빨 셋이 한 번에 + 낮은 몸통 울림)
def('rod-ratchet', () => { const o = buf(.09);
  for (const [t, v] of [[0, 1], [.014, .8], [.028, .65]]) { add(o, click(v, 2500), t); add(o, click(.35 * v, 1500), t + .002); }
  add(o, norm(thud(.07, 180, 1, .3)), 0, .3);
  return o; }, 64);
// 줄 풀리는 소리(드래그): 래칫이 빠르게 풀리며 지이이잉. 앱이 단계마다 높낮이를 바꾼다(새싹 높고 가볍게, 전설 낮고 묵직하게)
def('rod-drag', () => { const d = .62, o = buf(d + .15);
  for (let t = 0, k = 0; t < d; k++) { const p = t / d; add(o, click(.45 * (1 - p) ** .7 * (.8 + rnd() * .4), 2900 + rnd() * 300), t); t += 1 / (70 + 50 * Math.sin(Math.PI * Math.min(1, p * 1.6))); }
  add(o, norm(env(sing(d, 410, 1, .015), (t, k) => (1 - k) ** 1.5)), 0, .12);
  return reverb(o, { wet: .05, tail: .15 }); }, 64);
// 보석 · 전설 낚싯대 반짝이: 감을 때 · 챔질 때 겹쳐 나는 맑은 반짝
def('rod-shimmer', () => { const o = buf(.8);
  add(o, sparkle(.35, 9, .55, 2637), 0);
  add(o, bell(N(96), .5, .35, 1.3), .02);
  return reverb(o, { wet: .22, tail: .4 }); }, 56);
// 보석 · 전설 낚싯대 줄 끊김: 굵은 줄이 쩌억 + 깊은 쿵 + 길게 우는 피유웅
def('rod-snap-heavy', () => { const o = buf(1.2);
  add(o, norm(highpass(noise(.02), 1800).map((v, i) => v * Math.exp(-i / SR / .004))), 0, 1);
  add(o, norm(boom(.6, 44)), .01, .7);
  add(o, norm(twang(900, 120, .7)), 0, .55);
  add(o, norm(whoosh(.4, 2600, 300)), .03, .35);
  return reverb(o, { wet: .14, tail: .45 }); }, 64);

// ── 월척 ──
// 월척 순간: 시간이 멈춘 듯 낮게 쿠웅 + 거꾸로 빨려드는 바람 + 큰 물보라 + 금빛 종
def('trophy-boom', () => { const o = buf(2);
  add(o, norm(env(whoosh(.45, 300, 3000), (t, k) => k ** 1.5)), 0, .5);
  add(o, norm(boom(1.2, 40)), .4, 1);
  add(o, norm(water(.6, k => 380 * (1 - k) ** 1.2, [300, 2600], 1, .045)), .42, .6);
  [0, 7, 12, 16].forEach((st, i) => add(o, bell(N(72 + st), .9, .45, 1), .45 + i * .07));
  add(o, sparkle(.6, 10, .35, 2349), .6);
  return reverb(o, { wet: .2, tail: .6 }); }, 64);

// ── 깊은 바다 ──
// 낮은 울림(이어지는 소리): 아주 낮은 두 음이 천천히 맥놀이 + 먼 물살. 앱은 가운데 주기만 되풀이한다(sound.js SOUND_LOOP 1.2초)
const HUM = 1.2;
def('deep-hum', () => { const d = HUM + .2, o = buf(d);
  add(o, norm(pad([N(31), N(38)], d, { attack: .01, release: .01, harm: 6, tilt: 1.6 })), 0, .8);
  add(o, norm(lowpass(noise(d), 260)), 0, .35);
  return loopify(o, HUM); }, 48);
// 물방울: 깊은 곳에서 거품이 몇 개 올라오는 보글
def('deep-bubble', () => { const o = buf(.7);
  for (let k = 0, t = 0; k < 6; k++) { add(o, norm(bubble(500 + rnd() * 900, .05 + rnd() * .05, 1, 1.8)), t, .5 * (1 - k / 8)); t += .05 + rnd() * .09; }
  return reverb(o, { wet: .3, tail: .35 }); }, 48);
// 큰 그림자가 지나감: 낮은 우우웅 + 큰 몸이 물을 미는 느린 쉬이익
def('deep-pass', () => { const o = buf(2.3);
  add(o, norm(env(pad([N(28), N(35)], 2.1, { attack: .7, release: .9, harm: 5, tilt: 1.5 }), () => 1)), 0, .8);
  add(o, norm(env(bandpass(noise(2.1), t => 200 + 350 * Math.sin(Math.PI * t / 2.1), 1.2), (t, k) => Math.sin(Math.PI * k) ** 2)), 0, .5);
  return reverb(o, { wet: .25, tail: .3 }); }, 48);

// --- render & encode ---
const out = process.argv[2]; mkdirSync(out, { recursive: true }); let total = 0;
for (const { name, fn, kbps } of S) {
  seed = 7654321 + name.length * 131;
  const raw = fn(); let nan = 0; for (const v of raw) if (!Number.isFinite(v)) nan++;
  const x = name === 'deep-hum' ? norm(raw, .89) : finish(raw); // 이어지는 소리는 끝을 줄이거나 자르지 않는다
  let ss = 0; for (const v of x) ss += v * v; const rms = Math.sqrt(ss / x.length);
  const pcm = new Int16Array(x.length); for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, kbps), parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const t = enc.flush(); if (t.length) parts.push(Buffer.from(t));
  const b = Buffer.concat(parts); writeFileSync(join(out, name + '.mp3'), b); total += b.length;
  console.log(name.padEnd(13), (x.length / SR).toFixed(2) + 's', 'rms', (20 * Math.log10(rms)).toFixed(1) + 'dB', 'nan', nan, Math.round(b.length / 1024) + 'KB');
}
console.log(S.length, 'sounds', Math.round(total / 1024), 'KB');
