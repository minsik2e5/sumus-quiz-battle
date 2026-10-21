// V13.164 낚시 전용 고퀄 효과음 13개(던지기 휙 · 퐁당 · 입질 톡톡 · 쑥 · 챔질 · 릴 딸깍 · 줄 텐션 끼익(이어지는 소리) · 끼익 · 줄 끊김 · 돌진 · 점프 첨벙 · 끌어올림 물보라 · 퍼펙트 물빛).
// battle-synth.mjs의 악기를 그대로 쓰고, 물소리는 크고 작은 물방울(민나르트 공명)을 촘촘히 흩뿌려 만든다.
// 사용: (npm i --no-save @breezystack/lamejs 뒤) node docs/sound/reel-synth.mjs <출력 폴더> → <key>.mp3 를 public/assets/sfx/에 넣는다.
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

// ① 던지기: 낚싯대가 공기를 가르는 휙 → 줄이 풀리는 쉬이익 → 스풀이 촤르르(점점 느려짐)
def('reel-cast', () => { const o = buf(1.1);
  add(o, norm(whoosh(.26, 380, 4200)), 0, .9);
  add(o, norm(env(highpass(bandpass(noise(.7), t => 5200 - t * 2600, 2.5), 2500), (t, k) => Math.min(1, t / .02) * (1 - k) ** 2)), .14, .3);
  for (let k = 0, t = .16; t < .85; k++) { add(o, click(.32 * (1 - (t - .16) / .75), 3600 + rnd() * 300), t); t += .011 + k * .0016; }
  return reverb(o, { wet: .06, tail: .25 }); });
// 찌가 물에 퐁당: 큰 물방울 공명(퐁) + 수면 치는 소리 + 물 튐(당) + 떨어지는 물방울
def('reel-plop', () => { const o = buf(1.1);
  add(o, norm(bubble(380, .22, 1, 1.5)), .012, 1);
  add(o, norm(thud(.12, 120, 1, .2)), 0, .3);
  add(o, norm(spray(.18, 2200, 800, 1, .002, .8)), 0, .22);
  add(o, norm(water(.5, k => 60 * (1 - k), [900, 3800], 1, .02)), .06, .3);
  return reverb(o, { wet: .1, tail: .35 }); });
// ② 입질 톡톡(가짜): 찌가 두 번 작게 톡-톡(물방울 + 찌 몸통)
def('reel-nibble', () => { const o = buf(.4);
  for (const [t, v] of [[0, 1], [.085, .7]]) { add(o, norm(bubble(1350 + v * 200, .03, 1, 1.2)), t, .7 * v); add(o, mallet(N(91), .05, .5 * v, .1), t); add(o, highpass(noise(.006), 3000), t, .25 * v); }
  return reverb(o, { wet: .06, tail: .15 }); }, 64);
// 진짜 입질 쑥: 찌가 물속으로 꿀렁 빨려 들어가고 줄이 팽팽해지며 팅
def('reel-bite', () => { const o = buf(.95);
  add(o, norm(bubble(170, .32, 1, 2.2)), 0, .8);
  add(o, norm(env(lowpass(noise(.4), 900), (t, k) => Math.min(1, t / .03) * (1 - k) ** 2)), 0, .35);
  add(o, norm(water(.35, k => 90 * (1 - k), [500, 2200], 1, .03)), .03, .35);
  add(o, norm(pluck(196, .45, 1)), .05, .3);
  return reverb(o, { wet: .08, tail: .3 }); });
// 챔질(묵직하게): 낚싯대를 확 들어올리는 바람 + 깊은 저음 쿵 + 줄이 당겨지는 팅 + 휘는 끼익 + 물 튐
def('reel-hook', () => { const o = buf(1.3);
  add(o, norm(whoosh(.18, 300, 2600)), 0, .65);
  add(o, norm(boom(.6, 62)), .1, .9);
  add(o, norm(thud(.2, 95, 1, .5)), .1, .6);
  add(o, norm(pluck(147, .6, 1)), .1, .45);
  add(o, norm(creak(.35, k => 90 + k * 60, 1)), .12, .22);
  add(o, norm(spray(.3, 2400, 800, 1, .003)), .11, .2);
  return reverb(o, { wet: .1, tail: .4 }); });
// ③ 릴 딸깍: 감을 때 한 번씩(앱이 감는 속도만큼 자주, 빠를수록 높게 낸다)
def('reel-click', () => { const o = buf(.06); add(o, click(1, 3300)); add(o, click(.25, 2100), .004); return o; }, 64);
// 줄 텐션(이어지는 소리): 낚싯대가 버티는 끼이익 + 줄이 우는 낮은 소리 + 줄이 떨리는 높은 쉬. 앱이 텐션만큼 크고 높게 튼다
def('reel-strain', () => { const d = LOOP + .2, o = buf(d);
  add(o, norm(creak(d, k => 85 + 30 * Math.sin(TAU * k * 1.25), 1, [430, 1080, 2350])), 0, .7);
  add(o, norm(sing(d, 164, 1, .006)), 0, .22);
  add(o, norm(bandpass(noise(d), () => 2400, 14)), 0, .16);
  return loopify(o, LOOP); });
// 끼익(한 번): 텐션이 빨간 칸에 들어가거나 물고기가 확 당길 때
def('reel-creak', () => { const o = buf(.8);
  add(o, norm(env(creak(.55, k => 45 + 140 * Math.sin(Math.PI * Math.min(1, k * 1.2)), 1, [480, 1150, 2500]), (t, k) => Math.min(1, t / .04) * (1 - k) ** .7)), 0, .9);
  add(o, norm(env(sing(.5, 880, 1, .015), (t, k) => Math.sin(Math.PI * k))), .05, .12);
  return reverb(o, { wet: .06, tail: .2 }); });
// 줄 끊김: 팅! 끊어지는 순간 + 줄이 튕겨 나가는 피융 + 줄이 휘날리는 바람 + 릴이 헛도는 촤르르 + 낚싯대가 튕겨 툭
def('reel-snap', () => { const o = buf(1.5);
  add(o, norm(highpass(noise(.012), 2500).map((v, i) => v * Math.exp(-i / SR / .002))), 0, 1);
  add(o, norm(bell(N(100), .25, 1, 1.4)), 0, .22);
  add(o, norm(twang(1400, 240, .5)), 0, .55);
  add(o, norm(whoosh(.35, 3200, 500)), .03, .45);
  for (let k = 0, t = .05; t < .9; k++) { add(o, click(.3 * (1 - (t - .05) / .85) ** 1.5, 3500 + rnd() * 300), t); t += .009 + k * .0012; }
  add(o, norm(thud(.2, 80, 1, .3)), .02, .35);
  return reverb(o, { wet: .12, tail: .5 }); });
// 돌진: 물고기가 내달려 드래그가 끼이이잉(래칫이 빠르게 풀림) + 줄이 쉬익 + 수면을 가르는 물살
def('reel-run', () => { const d = 1.4, o = buf(d + .4);
  const vel = p => Math.min(1, p * 12) * (p < .55 ? 1 : 1 - (p - .55) / .45);
  for (let t = 0; t < d;) { const p = t / d; add(o, click(.4 * vel(p) * (.8 + rnd() * .4), 2500 + rnd() * 400), t); t += 1 / (40 + 60 * Math.min(1, p * 5) * (1 - .6 * Math.max(0, (p - .5) / .5))); }
  add(o, norm(env(bandpass(noise(d), () => 4600, 3), (t, k) => vel(k))), 0, .22);
  add(o, norm(env(sing(d, 330, 1, .012), (t, k) => vel(k))), 0, .1);
  add(o, norm(spray(.7, 1800, 700, 1, .05, .6)), 0, .25);
  return reverb(o, { wet: .07, tail: .3 }); });
// ④ 점프 첨벙: 물을 뚫고 솟구치는 촤악 + 거품이 터짐 + 떨어지는 물방울
def('reel-jump', () => { const o = buf(1.8);
  add(o, norm(spray(.5, 700, 3800, 1, .01, .6)), 0, .8);
  add(o, norm(water(.35, k => 400 * (1 - k), [400, 3000], 1, .035)), 0, .6);
  add(o, norm(bubble(220, .25, 1, 1.8)), .01, .4);
  add(o, norm(water(1.1, k => 70 * (1 - k) ** 1.5, [1200, 5200], 1, .018)), .25, .45);
  return reverb(o, { wet: .14, tail: .6 }); });
// ⑤ 끌어올림 물보라: 물 밖으로 확 촤아아 + 큰 거품 + 비처럼 떨어지는 물보라 + 햇빛에 반짝
def('reel-splash', () => { const o = buf(2.4);
  add(o, norm(env(bandpass(noise(.9), t => 1000 + 2200 * Math.exp(-t * 5), .5), t => Math.min(1, t / .015) * Math.exp(-t / .3))), 0, .7);
  add(o, norm(water(.6, k => 520 * (1 - k) ** 1.2, [350, 2800], 1, .04)), 0, .7);
  add(o, norm(water(1.6, k => 110 * (1 - k) ** 1.3, [1500, 6000], 1, .015)), .3, .5);
  add(o, sparkle(.9, 10, .35, 2637), .25);
  return reverb(o, { wet: .16, tail: .7 }); });
// 퍼펙트(캐스팅 · 마무리) · 기술 성공: 물빛이 반짝(종소리 오름 + 반짝이 + 작은 물방울)
def('reel-sparkle', () => { const o = buf(1.3);
  [0, 4, 7, 12].forEach((s, i) => add(o, bell(N(84 + s), .7, .5, 1.2), i * .055));
  add(o, sparkle(.5, 12, .5, 3136), .05);
  add(o, norm(water(.4, k => 60 * (1 - k), [2000, 6000], 1, .012)), 0, .25);
  return reverb(o, { wet: .18, tail: .6 }); });

// --- render & encode ---
const out = process.argv[2]; mkdirSync(out, { recursive: true }); let total = 0;
for (const { name, fn, kbps } of S) {
  seed = 7654321 + name.length * 131;
  const raw = fn(); let nan = 0; for (const v of raw) if (!Number.isFinite(v)) nan++;
  const x = name === 'reel-strain' ? norm(raw, .89) : finish(raw); // 이어지는 소리는 끝을 줄이거나 자르지 않는다
  let ss = 0; for (const v of x) ss += v * v; const rms = Math.sqrt(ss / x.length);
  const pcm = new Int16Array(x.length); for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, kbps), parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const t = enc.flush(); if (t.length) parts.push(Buffer.from(t));
  const b = Buffer.concat(parts); writeFileSync(join(out, name + '.mp3'), b); total += b.length;
  console.log(name.padEnd(13), (x.length / SR).toFixed(2) + 's', 'rms', (20 * Math.log10(rms)).toFixed(1) + 'dB', 'nan', nan, Math.round(b.length / 1024) + 'KB');
}
console.log(S.length, 'sounds', Math.round(total / 1024), 'KB');
