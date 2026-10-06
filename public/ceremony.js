/* ═══════════════════════════════════════════════════════════════════════════
   SUMUS ISLAND — 시상식 (공용)                                   /ceremony.js
   선생님 화면(프로젝터) 전용. 외부 라이브러리·이미지 없음. canvas + DOM.
   캐릭터는 /common.js 의 IQ.drawChar 를 사용(없으면 간단한 대체 그림).

   CEREMONY.show({
     title:    '휘슬! 최고 점수는…',          // 큰 제목
     subtitle: '홍길동 · 13,300점',            // 작은 설명 (선택)
     badge:    'PART 4 · 바나나킥',            // 제목 위 작은 알약 (선택)
     ranking: [                                // 이미 정렬됨 (0번 = 1등). 0~60명 이상
       { id, name, color,                      // color: '#rrggbb'
         main:  '13,300점',                    // 크게 보일 값
         stats: ['선방 71', 'WOW 62'],         // 작은 칩 (시상대에는 앞의 3개, 표에는 전부) — 잘리지 않고 줄바꿈
         tag:   '생존',                        // 선택: 이름 옆 작은 표시
         tagColor: '#1fb36b',                  // 선택 (없으면 '탈락/실패/못' 이 들어가면 빨강, 아니면 초록)
         rank:  4 },                           // 선택: 표시할 순위 (기본: 순서+1)
     ],
     podium:   3,          // 선택: 시상대에 올릴 인원 (기본 min(3, 인원)). 0 이면 시상대 없이 표만
     buttons:  [{ label: '한 판 더', primary: true, onClick() {} }],   // 아래 고정 막대
     sound:    true,       // 효과음 (WebAudio 합성)
     muted:    () => false,// 페이지의 음소거 상태 (매 프레임 확인)
     instant:  false,      // true: 연출 없이 최종 화면으로 바로 (새로고침으로 들어온 경우 등)
     delay:    0,          // 연출 시작 전 대기(ms) — 예: 종료 휘슬이 끝날 때까지
     parent:   document.body, // 붙일 곳 (요소 또는 선택자)
     zIndex:   40,         // 오버레이 z-index. #gameSwitch 막대(와 above 의 요소)는 그 위로 올려 줌
     above:    ['#hudR'],  // 선택: 오버레이 위로 올릴 요소 선택자
     charOpts: { glove: '#c8ff3c' },          // 선택: IQ.drawChar 에 더할 옵션
     drawCharacter: (ctx, x, y, size, entry, t, pose, face, opts) => {}, // 선택: 캐릭터 직접 그리기
                           //   (x,y)=발, pose: 'idle' | 'cheer' | 'clap', opts: { seed, arms, ...charOpts }
   });
   CEREMONY.hide();        // 지우기 (rAF·리스너·소리 정리)
   CEREMONY.skip();        // 연출 건너뛰고 최종 화면 (클릭 / Space / Enter 도 같음)
   CEREMONY.seek(sec, freeze); // (디버그) 연출 시각으로 이동 (freeze=true 면 그 시각에 멈춤)
   CEREMONY.tick(sec);     // (디버그) rAF 가 멈춘 숨은 탭에서 sec 초 진행 + 한 프레임
   CEREMONY.showing        // 보이는 중이면 true

   순서: 두구두구 → 3등(동) → 2등(은) → 두구두구 → 1등(금, 왕관·폭죽·환호) → 나머지 순위표.
   순위표는 절대 '…'로 자르지 않음: 칸 수·글자 크기를 화면에 맞추고, 그래도 넘치면 자동으로 쪽을 넘김.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = Math.random;
  const okColor = (c) => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#7dd3fc';
  const MET = {
    1: { name: 'gold', c: ['#fff4b8', '#f6cf55', '#d39b16', '#8c5c00'], top: '#ffe98a', txt: '#7a4d00', plate: '#f7cd4f', glow: 'rgba(255,205,80,' },
    2: { name: 'silver', c: ['#ffffff', '#dfe6ef', '#a5b2c3', '#5f6d80'], top: '#f4f7fb', txt: '#4a5668', plate: '#d6e0ec', glow: 'rgba(210,225,245,' },
    3: { name: 'bronze', c: ['#ffd9b5', '#e7a066', '#b0652e', '#6e3a14'], top: '#ffc79a', txt: '#5c2c0a', plate: '#eba26b', glow: 'rgba(240,160,100,' },
  };
  const CCOL = ['#f2c14e', '#ef4565', '#3b6cf6', '#1fb36b', '#f5a524', '#c084fc', '#7dd3fc', '#ffffff', '#ff8fd0'];

  /* ── CSS ── */
  const CSS = `
.cer{position:fixed;inset:0;overflow:hidden;color:#fff;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;user-select:none;-webkit-user-select:none;cursor:default;background:#06061a}
.cer *{box-sizing:border-box}
.cer canvas.cer-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.cer-head{position:absolute;top:0;text-align:center;pointer-events:none;padding-top:clamp(10px,2.2vh,26px)}
.cer-badge{display:inline-block;font-weight:900;font-size:clamp(12px,1.9vh,20px);letter-spacing:.06em;color:#ffe9a8;background:rgba(255,215,110,.12);border:1.5px solid rgba(255,215,110,.45);border-radius:999px;padding:.28em 1em;margin-bottom:.45vh}
.cer-title{font-weight:900;font-size:clamp(26px,6vh,72px);line-height:1.08;letter-spacing:-.02em;word-break:keep-all;overflow-wrap:anywhere;
  background:linear-gradient(180deg,#fff8d6 0%,#ffd75e 45%,#f0a92a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 rgba(0,0,0,.45)) drop-shadow(0 0 22px rgba(255,190,60,.35))}
.cer-sub{font-weight:800;font-size:clamp(14px,2.5vh,30px);color:#dfe6ff;margin-top:.5vh;word-break:keep-all;overflow-wrap:anywhere;text-shadow:0 2px 0 rgba(0,0,0,.4)}
.cer-head.anim{animation:cerHead .8s .15s cubic-bezier(.2,1.3,.4,1) both}
@keyframes cerHead{from{opacity:0;transform:translateY(-40px) scale(.9)}}
.cer-plate{position:absolute;text-align:center;color:#fff;padding:.3em .45em .42em;border-radius:.42em;
  background:linear-gradient(180deg,rgba(28,30,70,.94),rgba(10,10,32,.94));border:max(2px,.07em) solid var(--pc);
  box-shadow:0 0 1em var(--pg),0 .25em 0 rgba(0,0,0,.45);transform-origin:50% 100%;opacity:0;transform:translateY(.5em) scale(.6);
  transition:opacity .3s ease,transform .45s cubic-bezier(.2,1.6,.4,1);pointer-events:none}
.cer-plate.on{opacity:1;transform:none}
.cer-pn{font-weight:900;font-size:1em;line-height:1.12;word-break:keep-all;overflow-wrap:anywhere}
.cer-pm{font-weight:900;font-size:1.22em;line-height:1.08;color:var(--pc);font-variant-numeric:tabular-nums;letter-spacing:-.01em;margin-top:.06em;text-shadow:0 0 .5em var(--pg)}
.cer-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:.28em;margin-top:.3em;font-size:max(12px,.44em)}
.cer-chips span{background:rgba(255,255,255,.13);border-radius:999px;padding:.16em .62em;font-weight:800;color:#e3eaf7;white-space:nowrap}
.cer-tag{display:inline-block;font-style:normal;font-weight:900;font-size:.52em;vertical-align:.25em;margin-left:.35em;padding:.12em .55em;border-radius:999px;background:var(--tc);color:#fff;white-space:nowrap}
.cer-tbl{position:absolute;opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .6s cubic-bezier(.2,1.2,.4,1);pointer-events:none}
.cer-tbl.on{opacity:1;transform:none}
.cer-tl{display:flex;align-items:center;gap:.6em;height:1.7em;font-weight:900;color:#c7d2f2;font-size:.82em;letter-spacing:.03em}
.cer-tl .ln{flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.25),rgba(255,255,255,0))}
.cer-pg{display:flex;align-items:center;gap:.45em;color:#ffe08a}
.cer-pg i{display:block;width:.55em;height:.55em;border-radius:50%;background:rgba(255,255,255,.25)}
.cer-pg i.on{background:#ffd75e;box-shadow:0 0 .5em #ffd75e}
.cer-pbar{height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden;width:4em}
.cer-pbar b{display:block;height:100%;width:0;background:#ffd75e}
.cer-pages{position:relative}
.cer-page{position:absolute;left:0;top:0;right:0;display:flex;justify-content:center;align-items:flex-start;transition:opacity .5s ease,transform .5s ease}
.cer-page.out{opacity:0;transform:translateX(-30px)}
.cer-page.pre{opacity:0;transform:translateX(30px)}
.cer-col{display:flex;flex-direction:column}
.cer-row{display:flex;flex-wrap:wrap;align-items:center;column-gap:.5em;row-gap:.22em;padding:.32em .65em .32em .38em;border-radius:.5em;background:linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.08);line-height:1.15}
.cer-rk{flex:none;min-width:1.85em;height:1.55em;padding:0 .3em;border-radius:.45em;display:grid;place-items:center;font-weight:900;font-size:.9em;background:rgba(255,255,255,.12);color:#ffe08a;font-variant-numeric:tabular-nums}
.cer-dot{flex:none;width:.72em;height:.72em;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.cer-nm{flex:1 1 auto;min-width:0;font-weight:800;word-break:keep-all;overflow-wrap:anywhere}
.cer-nm .cer-tag{font-size:.66em;vertical-align:.12em}
.cer-mn{flex:none;font-weight:900;color:#ffd75e;font-variant-numeric:tabular-nums;white-space:nowrap}
.cer-ch{flex:0 1 auto;margin-left:auto;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.25em;font-size:.74em}
.cer-ch span{background:rgba(255,255,255,.1);border-radius:999px;padding:.12em .55em;font-weight:700;color:#d2dcef;white-space:nowrap}
.cer-row.in{animation:cerRow .45s cubic-bezier(.2,1.3,.4,1) both}
@keyframes cerRow{from{opacity:0;transform:translateY(12px) scale(.96)}}
.cer-meas{position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none}
.cer-empty{text-align:center;font-weight:800;color:#c7d2f2;font-size:clamp(16px,3vh,32px);padding-top:4vh}
.cer-bar{position:absolute;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;padding:10px 16px clamp(10px,1.8vh,20px);
  background:linear-gradient(180deg,rgba(5,5,20,0),rgba(5,5,20,.75) 40%)}
.cer-btn{font:inherit;cursor:pointer;border:0;font-weight:900;font-size:clamp(15px,2.4vh,24px);padding:.6em 1.4em;border-radius:.7em;background:rgba(255,255,255,.92);color:#16233a;box-shadow:0 .2em 0 rgba(0,0,0,.4);white-space:nowrap}
.cer-btn:hover{filter:brightness(1.06)}
.cer-btn:active{transform:translateY(2px);box-shadow:0 .1em 0 rgba(0,0,0,.4)}
.cer-btn.primary{background:linear-gradient(180deg,#ffe07a,#f2b928);color:#3a2600}
.cer-static *{transition:none!important;animation:none!important}
.cer-skip{position:absolute;left:16px;bottom:clamp(14px,2.2vh,24px);font-size:clamp(11px,1.6vh,15px);font-weight:800;color:rgba(255,255,255,.5);pointer-events:none;transition:opacity .4s}
`;
  let cssDone = false;
  function injectCss() { if (cssDone) return; cssDone = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

  /* ── 소리 ── */
  let AC = null, noiseBuf = null;
  function audio() {
    try {
      if (!AC) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
      }
      if (AC.state === 'suspended') AC.resume().catch(() => {});
    } catch (e) { AC = null; }
    return AC;
  }
  const unlock = () => { if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); };
  addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);

  let S = null; // 현재 시상식 상태

  function bus() {
    if (!S || !S.o.sound) return null; const ac = audio(); if (!ac || ac.state !== 'running') return null;
    if (!S.bus) { S.bus = ac.createGain(); S.bus.gain.value = 0.9; S.bus.connect(ac.destination); }
    return S.bus;
  }
  function cutSound() { if (S && S.bus) { try { S.bus.gain.setValueAtTime(0, AC.currentTime); S.bus.disconnect(); } catch (e) {} S.bus = null; } }
  function tone(f, d, type, v, when, slide, out) {
    const b = out || bus(); if (!b) return; const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + (when || 0);
    o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
    o.connect(g).connect(b); o.start(t0); o.stop(t0 + d + 0.03);
  }
  function noise(d, ftype, f0, f1, v, when, q, attack) {
    const b = bus(); if (!b) return; const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(), t0 = AC.currentTime + (when || 0);
    s.buffer = noiseBuf; s.loop = true; fl.type = ftype; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
    s.connect(fl).connect(g).connect(b); s.start(t0, rnd() * 0.5); s.stop(t0 + d + 0.03);
  }
  function brass(freqs, when, dur, vol) { // 금관 느낌: 톱니파 두 개 + 열리는 저역 필터
    const b = bus(); if (!b) return; const t0 = AC.currentTime + when;
    const fl = AC.createBiquadFilter(), g = AC.createGain(); fl.type = 'lowpass'; fl.Q.value = 1.5;
    fl.frequency.setValueAtTime(500, t0); fl.frequency.linearRampToValueAtTime(3200, t0 + 0.06); fl.frequency.exponentialRampToValueAtTime(1400, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.03); g.gain.setValueAtTime(vol * 0.8, t0 + Math.max(0.05, dur - 0.12)); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    fl.connect(g).connect(b);
    for (const f of freqs) for (const dt of [-4, 4]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(fl); o.start(t0); o.stop(t0 + dur + 0.05); }
  }
  const SND = {
    drum(dur) { // 스네어 롤 (점점 커짐) + 마지막 둥
      if (!bus()) return; const n = Math.floor(dur / 0.042);
      for (let i = 0; i < n; i++) { const u = i / n; noise(0.06, 'bandpass', 1900, 1500, 0.05 + u * 0.2, i * 0.042 + (i % 2) * 0.006, 0.8, 0.002); if (i % 6 === 0) tone(110 + u * 30, 0.12, 'sine', 0.06 + u * 0.1, i * 0.042, 70); }
    },
    land(rank) { // 따-단!
      if (!bus()) return;
      const ch = rank === 3 ? [392, 494, 587] : [440, 554, 659];
      noise(1.2, 'highpass', 6000, 3500, 0.12, 0, 0.6, 0.002);
      tone(90, 0.3, 'sine', 0.35, 0, 45);
      brass(ch.map(f => f * 0.75), 0, 0.14, 0.09); brass(ch, 0.16, 0.75, 0.11);
    },
    fanfare() {
      if (!bus()) return;
      const q = 0.13;
      [[523], [523], [523], [659, 784]].forEach((n, i) => brass(n, i * q, i === 3 ? 0.3 : 0.11, 0.1));
      brass([392, 523, 659, 1046], 4 * q + 0.12, 1.7, 0.13);
      for (let i = 0; i < 6; i++) tone(70, 0.25, 'sine', 0.3, 4 * q + 0.12 + i * 0.07, 50);
      noise(2, 'highpass', 7000, 3000, 0.16, 4 * q + 0.12, 0.5, 0.002);
      [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.5, 'sine', 0.05, 4 * q + 0.5 + i * 0.09));
    },
    cheer() {
      if (!bus()) return;
      noise(3.2, 'bandpass', 1300, 1700, 0.13, 0, 0.6, 0.45); noise(2.6, 'bandpass', 2800, 2300, 0.06, 0.1, 0.9, 0.4);
      for (let i = 0; i < 40; i++) noise(0.035, 'bandpass', 1500 + rnd() * 900, 1200, 0.07 + rnd() * 0.05, 0.1 + rnd() * 2.6, 1.2, 0.001);
      for (let i = 0; i < 4; i++) { const w = 0.3 + rnd() * 1.8; tone(1800 + rnd() * 500, 0.35, 'sine', 0.025, w, 2600 + rnd() * 400); }
    },
    pop() {
      if (!bus()) return;
      noise(0.45, 'lowpass', 900, 120, 0.22, 0, 0.7, 0.002); tone(80, 0.25, 'sine', 0.15, 0, 40);
      for (let i = 0; i < 7; i++) noise(0.03, 'highpass', 4000, 3000, 0.05, 0.15 + rnd() * 0.5, 1, 0.001);
    },
    whoosh() { if (!bus()) return; noise(0.5, 'bandpass', 400, 2400, 0.07, 0, 1.4, 0.3); },
  };

  /* ── 시작 / 끝 ── */
  function show(o) {
    hide(); injectCss();
    o = Object.assign({ title: '', subtitle: '', badge: '', ranking: [], buttons: [], sound: true, muted: () => false, instant: false, delay: 0, zIndex: 40, above: [] }, o || {});
    const ranking = (o.ranking || []).map((e, i) => Object.assign({}, e, { color: okColor(e.color), rank: e.rank != null ? e.rank : i + 1, stats: (e.stats || []).filter(x => x != null && x !== '') }));
    const P = clamp(o.podium != null ? Math.floor(o.podium) : 3, 0, Math.min(3, ranking.length));
    const parent = typeof o.parent === 'string' ? document.querySelector(o.parent) : (o.parent || document.body);
    const root = document.createElement('div'); root.className = 'cer'; root.style.zIndex = o.zIndex;
    root.innerHTML = `<canvas class="cer-cv"></canvas>
      <div class="cer-head${o.instant ? '' : ' anim'}">${o.badge ? `<div class="cer-badge">${esc(o.badge)}</div><br>` : ''}<div class="cer-title">${esc(o.title)}</div>${o.subtitle ? `<div class="cer-sub">${esc(o.subtitle)}</div>` : ''}</div>
      <div class="cer-tbl"><div class="cer-tl"><span class="lb"></span><span class="ln"></span><span class="cer-pg"></span></div><div class="cer-pages"></div></div>
      <div class="cer-meas"></div>
      <div class="cer-skip">클릭 또는 Space — 바로 결과 보기</div>
      <div class="cer-bar"></div>`;
    parent.appendChild(root);
    const $r = (s) => root.querySelector(s);
    S = {
      o, ranking, P, root, parent, cv: $r('.cer-cv'), head: $r('.cer-head'), tbl: $r('.cer-tbl'), pagesEl: $r('.cer-pages'), pgEl: $r('.cer-pg'), meas: $r('.cer-meas'), bar: $r('.cer-bar'), skipEl: $r('.cer-skip'),
      rest: ranking.slice(P), podium: ranking.slice(0, P), plates: {}, raised: [], fired: new Set(), parts: [], rockets: [], sparks: [], dust: [],
      t0: performance.now() + (o.instant ? 0 : o.delay || 0), lastPn: performance.now(), done: false, doneAt: 0, table: null, page: 0, pageT: 0, tableOn: false,
    };
    S.ctx = S.cv.getContext('2d'); if (o.sound && !o.instant) audio();
    S.tl = timeline(P, S.rest.length);
    // 버튼
    for (const b of o.buttons || []) {
      const el = document.createElement('button'); el.className = 'cer-btn' + (b.primary ? ' primary' : ''); el.textContent = b.label;
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('click', (e) => { e.stopPropagation(); try { b.onClick && b.onClick(); } catch (err) { console.error(err); } });
      S.bar.appendChild(el);
    }
    if (!(o.buttons || []).length) S.bar.style.minHeight = '20px';
    // 시상대 이름표
    S.podium.forEach((e, idx) => {
      const m = MET[idx + 1];
      const el = document.createElement('div'); el.className = 'cer-plate';
      el.style.setProperty('--pc', m.plate); el.style.setProperty('--pg', m.glow + '.45)');
      el.innerHTML = `<div class="cer-pn">${esc(e.name)}${tagHtml(e)}</div>${e.main != null && e.main !== '' ? `<div class="cer-pm">${esc(e.main)}</div>` : ''}${e.stats.length ? `<div class="cer-chips">${e.stats.slice(0, 3).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}`;
      root.insertBefore(el, S.tbl); S.plates[idx + 1] = el;
    });
    // 순위표 줄 (측정용)
    S.rowEls = S.rest.map(rowEl);
    for (const r of S.rowEls) S.meas.appendChild(r);
    S.meas.style.display = 'flex'; S.meas.style.flexDirection = 'column';
    $r('.lb').textContent = S.rest.length ? (P ? `${S.rest[0].rank}위부터` : '전체 순위') : '';
    // 다른 UI(게임 전환 막대 등)는 오버레이 위로
    const sels = ['#gameSwitch'].concat(o.above || []);
    for (const sel of sels) {
      let el = document.querySelector(sel); if (!el) continue;
      if (sel === '#gameSwitch' && el.parentElement && el.parentElement !== document.body) el = el.parentElement;
      if (S.raised.some(r => r.el === el)) continue;
      S.raised.push({ el, z: el.style.zIndex }); el.style.zIndex = String(o.zIndex + 1);
    }
    // 입력
    S.onKey = (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (!S.done || performance.now() - S.doneAt < 700) { e.preventDefault(); e.stopImmediatePropagation(); if (!S.done) skip(); }
    };
    S.onClick = (e) => { if (!S.done && !(e.target.closest && e.target.closest('button'))) skip(); };
    S.onResize = () => { S.dirty = true; };
    addEventListener('keydown', S.onKey, true); root.addEventListener('click', S.onClick); addEventListener('resize', S.onResize);
    if (o.instant) jumpToEnd(true);
    stars();
    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S && S.root === root) S.dirty = true; });
    S.raf = requestAnimationFrame(frame);
    return S;
  }
  function hide() {
    if (!S) return;
    cancelAnimationFrame(S.raf); cutSound();
    removeEventListener('keydown', S.onKey, true); removeEventListener('resize', S.onResize);
    for (const r of S.raised) r.el.style.zIndex = r.z;
    S.root.remove(); S = null;
  }
  function tagHtml(e) {
    if (!e.tag) return '';
    const c = e.tagColor || (/탈락|실패|못|아웃|OUT/i.test(e.tag) ? '#d6455c' : '#1fa866');
    return ` <em class="cer-tag" style="--tc:${esc(c)}">${esc(e.tag)}</em>`;
  }
  function rowEl(e) {
    const d = document.createElement('div'); d.className = 'cer-row'; d.style.setProperty('--c', e.color);
    d.innerHTML = `<span class="cer-rk">${esc(e.rank)}</span><i class="cer-dot"></i><span class="cer-nm">${esc(e.name)}${tagHtml(e)}</span>${e.main != null && e.main !== '' ? `<b class="cer-mn">${esc(e.main)}</b>` : ''}${e.stats.length ? `<span class="cer-ch">${e.stats.map(s => `<span>${esc(s)}</span>`).join('')}</span>` : ''}`;
    return d;
  }

  /* ── 시간표 ── */
  function timeline(P, R) {
    const tl = { reveal: {}, drums: [], win: null, trans: 0, table: 0, end: 0 };
    if (P === 3) { tl.drums.push([0.35, 1.5]); tl.reveal[3] = 1.9; tl.reveal[2] = 3.15; tl.drums.push([3.75, 1.15]); tl.reveal[1] = 4.95; }
    else if (P === 2) { tl.drums.push([0.35, 1.5]); tl.reveal[2] = 1.9; tl.drums.push([2.6, 1.2]); tl.reveal[1] = 3.85; }
    else if (P === 1) { tl.drums.push([0.35, 1.7]); tl.reveal[1] = 2.1; }
    if (P) { tl.win = tl.reveal[1]; tl.trans = tl.win + 1.1; tl.table = tl.trans + 0.35; }
    else { tl.drums.push([0.3, 0.8]); tl.trans = 0; tl.table = 1.15; }
    tl.end = R || !P ? tl.table + 0.3 + Math.min(0.5, R * 0.02) : tl.win + 1.2;
    return tl;
  }
  const T = () => S.freezeT != null ? S.freezeT : (performance.now() - S.t0) / 1000;
  function skip() {
    if (!S || S.done) return;
    const hadWin = S.tl.win != null && S.fired.has('win');
    cutSound(); jumpToEnd(false);
    if (S.tl.win != null && !hadWin) { winBurst(true); SND.fanfare(); setTimeout(() => { if (S) SND.cheer(); }, 500); }
    else if (!S.tl.win) SND.land(2);
  }
  function jumpToEnd(silent) {
    S.t0 = performance.now() - S.tl.end * 1000 - 50;
    for (const k of eventKeys()) S.fired.add(k);
    S.done = true; S.doneAt = performance.now(); S.silentEnd = silent; S.nextRocket = T() + 2;
    for (const k in S.plates) S.plates[k].classList.add('on');
  }
  function eventKeys() { const ks = ['win']; S.tl.drums.forEach((_, i) => ks.push('drum' + i)); for (const r in S.tl.reveal) ks.push('land' + r); ks.push('table'); return ks; }
  function seek(sec, freeze) {
    if (!S) return;
    cutSound(); S.t0 = performance.now() - sec * 1000; S.freezeT = freeze ? sec : null; S.root.classList.toggle('cer-static', !!freeze);
    for (const k of eventKeys()) S.fired.delete(k);
    S.done = false; S.tableOn = false; S.tbl.classList.remove('on');
    for (const k in S.plates) S.plates[k].classList.remove('on');
    S.parts.length = 0; S.rockets.length = 0; S.sparks.length = 0; S.dust.length = 0;
    S.seekSilent = true; S.lastPn = performance.now() - 16; step(performance.now());
  }

  /* ── 배치 ── */
  function obstruction() {
    let rr = null;
    for (const r of S.raised) { const b = r.el.getBoundingClientRect(); if (!b.width || !b.height) continue; rr = rr ? { left: Math.min(rr.left, b.left), right: Math.max(rr.right, b.right), bottom: Math.max(rr.bottom, b.bottom) } : { left: b.left, right: b.right, bottom: b.bottom }; }
    return rr;
  }
  function layout() {
    S.dirty = false;
    const rb = S.root.getBoundingClientRect(), W = Math.max(320, rb.width), H = Math.max(240, rb.height);
    S.W = W; S.H = H; S.DPR = Math.min(2, window.devicePixelRatio || 1);
    S.cv.width = Math.round(W * S.DPR); S.cv.height = Math.round(H * S.DPR);
    const pad = Math.max(14, W * 0.015);
    // 제목: 오른쪽 위 막대와 겹치지 않게
    const ob = obstruction(), hd = S.head.style; hd.top = '0px';
    const side = ob ? W - ob.left + 14 : pad;
    if (!ob || W - 2 * side >= Math.min(560, W * 0.5)) { hd.left = side + 'px'; hd.right = side + 'px'; hd.textAlign = 'center'; }
    else if (ob.left - 2 * pad >= 300) { hd.left = pad + 'px'; hd.right = (W - ob.left + 12) + 'px'; hd.textAlign = 'left'; }
    else { hd.left = pad + 'px'; hd.right = pad + 'px'; hd.textAlign = 'center'; hd.top = Math.round(ob.bottom - rb.top + 2) + 'px'; }
    const hb = S.head.offsetTop + S.head.offsetHeight;
    const barTop = H - S.bar.offsetHeight;
    S.skipEl.style.display = W < 900 || S.o.buttons.length > 2 ? 'none' : '';
    const y0 = hb + H * 0.018, y1 = barTop - H * 0.01;
    S.y0 = y0; S.y1 = y1; S.pad = pad;
    // 시상대 칸 폭
    const P = S.P;
    S.gap = W * 0.014;
    S.cw = P >= 2 ? Math.min((W - 2 * pad - 2 * S.gap) / 3, H * 0.62, 470) : Math.min(W * 0.42, H * 0.7, 480);
    S.order = P === 3 ? [2, 1, 3] : P === 2 ? [2, 1] : P === 1 ? [1] : [];
    S.groupW = S.order.length * S.cw + (S.order.length - 1) * S.gap;
    S.baseFs = clamp(Math.min(H * 0.043, S.cw * 0.125), 15, 52);
    const tblW = Math.min(W - 2 * pad, 1700), tblX = (W - tblW) / 2;
    const R = S.rest.length, F1 = Math.max(15, H * 0.025), F2 = Math.max(13, H * 0.02), FP = R > 24 ? F2 : F1;
    S.fit = null; S.tblRect = { x: tblX, y: y0, w: tblW, h: y1 - y0 }; S.tblCenter = !P;
    if (P) {
      S.big = podLayout(1, y0, y1, W / 2, 1);
      S.fin = S.big;
      if (R) {
        // ① 위: 시상대(작게) / 아래: 순위표   ② 옆: 왼쪽 시상대 / 오른쪽 순위표 — 더 크게 보이는 쪽
        const cands = [];
        const tryV = (k, floor) => { const L = podLayout(k, y0, y1, W / 2, 1), top = y0 + L.used + H * 0.02, rect = { x: tblX, y: top, w: tblW, h: y1 - top }; return { mode: 'v', L, rect, fit: fitTable(rect.w, rect.h, floor) }; };
        let v = null;
        for (const k of [1, 0.9, 0.82, 0.75, 0.68]) { const c = tryV(k, F1); if (c.fit) { v = c; break; } }
        if (!v) for (const k of [0.62, 0.56]) { const c = tryV(k, F2); if (c.fit) { v = c; break; } }
        if (!v) { v = tryV(0.62, 99); v.fit = fitPaged(v.rect.w, v.rect.h, FP); }
        cands.push(v);
        if (!v.fit.pages || v.fit.pages.length > 1) { const c = tryV(0.5, 99); c.fit = fitTable(c.rect.w, c.rect.h, F2) || fitPaged(c.rect.w, c.rect.h, FP); cands.push(c); }
        if (W / H >= 1.4) for (const tf of [0.36, 0.46, 0.56]) {
          const tw = clamp(W * tf, 300, 1000), regW = W - 2 * pad - tw - W * 0.025, kw = Math.min(1, regW / S.groupW);
          if (kw < 0.45) continue;
          const L = podLayout(kw, y0, y1, pad + regW / 2, kw), rect = { x: W - pad - tw, y: y0 + H * 0.01, w: tw, h: y1 - y0 - H * 0.01 };
          cands.push({ mode: 's', L, rect, fit: fitTable(rect.w, rect.h, F1) || fitPaged(rect.w, rect.h, FP) });
        }
        const score = (c) => (c.fit.pages.length === 1 ? 1000 : 0) - c.fit.pages.length * 25 + c.L.s / H * 100 + c.fit.fs / H * 60;
        cands.sort((a, b) => score(b) - score(a));
        const c = cands[0];
        S.fin = c.mode === 'v' ? podLayout(c.L.k, y0, y0 + c.L.used, W / 2, 1) : c.L;
        S.fit = c.fit; S.tblRect = c.rect; S.tblCenter = c.mode === 's';
      }
    } else { S.big = S.fin = null; if (R) S.fit = fitTable(tblW, y1 - y0, F2) || fitPaged(tblW, y1 - y0, FP); }
    for (const k in S.plates) S.plates[k]._k = null;
    buildTable();
    S.bg = null; // 배경 다시 그림
  }
  function measurePlate(r, fs, w) { const el = S.plates[r]; el.style.fontSize = fs + 'px'; el.style.width = w + 'px'; return el.offsetHeight; }
  // k: 크기 배율(캐릭터·시상대·글자), cx0: 가운데, wk: 칸 폭 배율
  function podLayout(k, top, bottom, cx0, wk) {
    const H = S.H, cw = S.cw * wk, gap = S.gap * wk, fs = S.baseFs * Math.max(0.72, k), pw = cw * 0.98, avail = bottom - top;
    let s = Math.min(H * 0.098 * k, cw * 0.33), h1 = H * 0.19 * k;
    const cols = {}, cx = {}; let q = 9, used = 0;
    const dpt = cw * 0.07, gw = S.order.length * cw + (S.order.length - 1) * gap;
    S.order.forEach((r, i) => { cx[r] = cx0 - gw / 2 + cw / 2 + i * (cw + gap); });
    for (const r of S.order) {
      const pfs = fs * (r === 1 ? 1.1 : 1), ph = measurePlate(r, pfs, pw);
      const hr = [1, 0.68, 0.48][r - 1];
      const charK = 2.32 + (r === 1 ? 0.95 : 0.15); // 1등은 왕관 + 점프 여유
      cols[r] = { r, pfs, ph, hr, charK };
      q = Math.min(q, (avail - ph - H * 0.012 - dpt * 0.6) / (charK * s + hr * h1));
    }
    if (q < 1) { s *= Math.max(0.2, q); h1 *= Math.max(0.2, q); }
    for (const r of S.order) { const c = cols[r]; used = Math.max(used, c.ph + H * 0.012 + c.charK * s + c.hr * h1 + dpt * 0.6); }
    return { k, fs, pw, cw, cx, s, h1, dpt, cols, floor: bottom, used: Math.min(used, avail) };
  }
  function tableCfg(Wt, Ht, fs, cols) {
    const gapC = Math.max(10, Wt * 0.012), gapR = fs * 0.3, colH = Ht - fs * 0.82 * 1.7 - 4;
    const colW = Math.min((Wt - (cols - 1) * gapC) / cols, fs * 32);
    S.meas.style.fontSize = fs + 'px'; S.meas.style.width = colW + 'px';
    const hs = S.rowEls.map(r => r.offsetHeight);
    return { fs, cols, colW, gapC, gapR, colH, pages: pack(hs, colH, gapR, cols) };
  }
  const maxColsAt = (Wt, fs) => clamp(Math.floor((Wt + 12) / (fs * 17 + 12)), 1, 3);
  // 한 쪽에 다 들어가는 가장 큰 글씨 (floor 보다 작으면 null)
  function fitTable(Wt, Ht, floor) {
    const fsMax = clamp(S.H * 0.034, 15, 38);
    if (Ht < floor * 3) return null;
    for (let fs = fsMax; fs >= floor - 0.01; fs *= 0.92) {
      for (let cols = 1; cols <= maxColsAt(Wt, fs); cols++) { const c = tableCfg(Wt, Ht, fs, cols); if (c.pages.length === 1) return c; }
    }
    return null;
  }
  // 넘치면: 읽을 수 있는 글씨로 여러 쪽 (자동 넘김)
  function fitPaged(Wt, Ht, fs) { let best = null; for (let c = 1; c <= maxColsAt(Wt, fs); c++) { const t = tableCfg(Wt, Math.max(Ht, fs * 4), fs, c); if (!best || t.pages.length < best.pages.length) best = t; } return best; }
  function pack(hs, colH, gapR, cols) {
    const columns = []; let cur = [], h = 0;
    hs.forEach((hh, i) => { if (cur.length && h + hh > colH) { columns.push(cur); cur = []; h = 0; } cur.push(i); h += hh + gapR; });
    if (cur.length) columns.push(cur);
    if (columns.length <= cols) { // 한 쪽이면 칸 길이를 고르게
      const n = hs.length, per = Math.ceil(n / Math.min(cols, Math.max(1, columns.length)));
      const bal = []; for (let i = 0; i < n; i += per) bal.push([...Array(Math.min(per, n - i)).keys()].map(j => i + j));
      const okBal = bal.every(c => c.reduce((a, i) => a + hs[i] + gapR, -gapR) <= colH);
      return [okBal ? bal : columns];
    }
    const pages = []; for (let i = 0; i < columns.length; i += cols) pages.push(columns.slice(i, i + cols));
    return pages;
  }
  function buildTable() {
    const f = S.fit; S.pagesEl.innerHTML = ''; S.pageEls = [];
    if (!S.rest.length) {
      if (!S.P) { S.pagesEl.innerHTML = `<div class="cer-empty">${S.ranking.length ? '' : '참가자가 없어요'}</div>`; S.tbl.style.cssText = `left:${S.tblRect.x}px;top:${S.tblRect.y}px;width:${S.tblRect.w}px`; }
      S.tbl.style.display = S.P ? 'none' : ''; return;
    }
    S.tbl.style.display = '';
    S.tbl.style.left = S.tblRect.x + 'px'; S.tbl.style.top = S.tblRect.y + 'px'; S.tbl.style.width = S.tblRect.w + 'px'; S.tbl.style.fontSize = f.fs + 'px';
    S.pagesEl.style.height = f.colH + 'px';
    f.pages.forEach((pg, pi) => {
      const p = document.createElement('div'); p.className = 'cer-page' + (pi === S.page % f.pages.length ? '' : ' pre'); p.style.gap = f.gapC + 'px';
      if (pi !== S.page % f.pages.length) p.style.visibility = 'hidden';
      for (const col of pg) {
        const c = document.createElement('div'); c.className = 'cer-col'; c.style.width = f.colW + 'px'; c.style.gap = f.gapR + 'px';
        col.forEach((i) => { const r = S.rowEls[i].cloneNode(true); c.appendChild(r); });
        p.appendChild(c);
      }
      S.pagesEl.appendChild(p); S.pageEls.push(p);
    });
    S.page = S.page % f.pages.length;
    if (S.tblCenter) { const ph = Math.max(...S.pageEls.map(p => p.offsetHeight)); if (ph < f.colH) { S.pagesEl.style.height = ph + 'px'; S.tbl.style.top = (S.tblRect.y + (f.colH - ph) / 2) + 'px'; } }
    const n = f.pages.length;
    S.pgEl.innerHTML = n > 1 ? `${[...Array(n)].map((_, i) => `<i class="${i === S.page ? 'on' : ''}"></i>`).join('')}<span>${S.page + 1} / ${n}</span><span class="cer-pbar"><b></b></span>` : '';
    S.pageDur = 4.2 + Math.min(4, S.rowEls.length / n * 0.12);
  }
  function animRows(pageEl, base) {
    [...pageEl.querySelectorAll('.cer-row')].forEach((r, i) => { r.classList.remove('in'); void r.offsetWidth; r.style.animationDelay = (base + Math.min(0.9, i * 0.035)) + 's'; r.classList.add('in'); });
  }
  function flipPage() {
    const n = S.pageEls.length; if (n < 2) return;
    const old = S.pageEls[S.page]; S.page = (S.page + 1) % n; const nw = S.pageEls[S.page];
    old.classList.add('out'); setTimeout(() => { old.style.visibility = 'hidden'; old.classList.remove('out'); old.classList.add('pre'); }, 500);
    nw.style.visibility = ''; nw.classList.add('pre'); void nw.offsetWidth; nw.classList.remove('pre'); animRows(nw, 0.05);
    S.pgEl.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === S.page));
    const sp = S.pgEl.querySelector('span'); if (sp) sp.textContent = `${S.page + 1} / ${n}`;
    SND.whoosh();
  }

  /* ── 효과 ── */
  function stars() { S.stars = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd() * 0.75, r: 0.6 + rnd() * 1.8, p: rnd() * 6, sp: 0.6 + rnd() * 2 })); }
  function confetti(x, y, n, spread, cols) {
    const H = S.H;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * spread; const v = H * (0.5 + rnd() * 0.9);
      S.parts.push({ x, y, vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v, r: 5 + rnd() * 7, a: rnd() * 6, va: (rnd() - 0.5) * 14, c: (cols || CCOL)[i % (cols || CCOL).length], life: 0 }); }
  }
  function rain(n) { const W = S.W, H = S.H; for (let i = 0; i < n; i++) S.parts.push({ x: rnd() * W, y: -rnd() * H * 0.5, vx: (rnd() - 0.5) * 60, vy: rnd() * 80, r: 5 + rnd() * 6, a: rnd() * 6, va: (rnd() - 0.5) * 10, c: CCOL[i % CCOL.length], life: 0 }); }
  function rocket(loud) {
    const W = S.W, H = S.H, x = W * (0.12 + rnd() * 0.76);
    S.rockets.push({ x, y: H, vx: (rnd() - 0.5) * W * 0.08, vy: -H * (1.05 + rnd() * 0.35), ty: H * (0.12 + rnd() * 0.28), c: CCOL[(rnd() * CCOL.length) | 0], c2: CCOL[(rnd() * CCOL.length) | 0], loud });
  }
  function explode(r) {
    const n = 60 + ((rnd() * 30) | 0), sp = S.H * (0.22 + rnd() * 0.12);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * 0.1, v = sp * (0.75 + rnd() * 0.3);
      S.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.1 + rnd() * 0.7, c: i % 3 ? r.c : r.c2 }); }
    S.flash = Math.max(S.flash || 0, 0.25);
    if (r.loud) SND.pop();
  }
  function winBurst(loud) {
    const L = cur(), cx = L ? L.cx[1] : S.W / 2, fy = L ? feetY(L, 1) : S.H * 0.5;
    confetti(cx, fy - (L ? L.s * 1.2 : 0), 200, 2.2); rain(140);
    S.trickleUntil = T() + 6;
    for (let i = 0; i < 5; i++) setTimeout(() => { if (S) rocket(loud); }, i * 260);
    S.nextRocket = T() + 2.2;
    S.flash = 0.6;
  }
  function fire(key, late) {
    if (S.fired.has(key)) return; S.fired.add(key);
    const quiet = late || S.seekSilent;
    if (key.startsWith('drum')) { if (!quiet) SND.drum(S.tl.drums[+key.slice(4)][1]); return; }
    if (key.startsWith('land')) {
      const r = +key.slice(4); if (S.plates[r]) { if (S.freezeT != null) S.plates[r].classList.add('on'); else setTimeout(() => S && S.plates[r] && S.plates[r].classList.add('on'), 140); }
      const L = cur(); if (L) { const fy = feetY(L, r); for (let i = 0; i < 16; i++) S.dust.push({ x: L.cx[r] + (rnd() - 0.5) * L.s, y: fy, vx: (rnd() - 0.5) * L.s * 6, vy: -rnd() * L.s * 1.5, life: 0, r: L.s * (0.12 + rnd() * 0.12) }); }
      if (r === 1) return; // 1등은 'win' 에서
      if (!quiet) SND.land(r);
      { const L2 = cur(); if (L2) confetti(L2.cx[r], S.y0 + (S.y1 - S.y0) * 0.45, 45, 1.2, [MET[r].plate, '#ffffff', MET[r].c[1]]); }
      return;
    }
    if (key === 'win') { if (S.silentEnd) { S.nextRocket = T() + 2; return; } winBurst(!quiet); if (!quiet) { SND.fanfare(); setTimeout(() => { if (S) SND.cheer(); }, 450); } return; }
    if (key === 'table') { if (!S.P && !quiet) SND.land(2); }
  }

  /* ── 그리기 ── */
  function cur() { // 지금의 시상대 배치 (큰 배치 → 최종 배치 보간)
    if (!S.big) return null;
    const m = S.fin === S.big ? 0 : ease((T() - S.tl.trans) / 0.9);
    if (m <= 0) return S.big; if (m >= 1) return S.fin;
    const a = S.big, b = S.fin, cols = {};
    for (const r of S.order) cols[r] = Object.assign({}, a.cols[r], { pfs: lerp(a.cols[r].pfs, b.cols[r].pfs, m) });
    const cx = {}; for (const r of S.order) cx[r] = lerp(a.cx[r], b.cx[r], m);
    return { k: lerp(a.k, b.k, m), s: lerp(a.s, b.s, m), h1: lerp(a.h1, b.h1, m), dpt: lerp(a.dpt, b.dpt, m), floor: lerp(a.floor, b.floor, m), pw: lerp(a.pw, b.pw, m), cw: lerp(a.cw, b.cw, m), cx, cols, m };
  }
  const blockTop = (L, r) => L.floor - L.cols[r].hr * L.h1;
  const feetY = (L, r) => blockTop(L, r) - L.dpt * 0.45;
  function bgCanvas() {
    const W = S.W, H = S.H, c = document.createElement('canvas'); c.width = S.cv.width; c.height = S.cv.height;
    const g = c.getContext('2d'); g.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
    let gr = g.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.75);
    gr.addColorStop(0, '#2a1c66'); gr.addColorStop(0.45, '#140f3d'); gr.addColorStop(1, '#04040f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 커튼
    const cwid = Math.max(30, W * 0.065);
    for (const side of [0, 1]) {
      const x0 = side ? W - cwid : 0;
      for (let i = 0; i < 6; i++) {
        const fx = x0 + (i / 6) * cwid, fw = cwid / 6;
        const lg = g.createLinearGradient(fx, 0, fx + fw, 0); lg.addColorStop(0, '#3a0618'); lg.addColorStop(0.5, '#8c1434'); lg.addColorStop(1, '#3a0618');
        g.fillStyle = lg; g.fillRect(fx, 0, fw + 0.5, H);
      }
      const sh = g.createLinearGradient(x0, 0, x0 + cwid, 0); sh.addColorStop(side ? 0 : 1, 'rgba(0,0,0,.55)'); sh.addColorStop(side ? 1 : 0, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(x0, 0, cwid, H);
    }
    // 위 장식 커튼
    const vh = Math.max(14, H * 0.035);
    const vg = g.createLinearGradient(0, 0, 0, vh); vg.addColorStop(0, '#5a0a22'); vg.addColorStop(1, '#9b1a3c');
    g.fillStyle = vg; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, vh * 0.6);
    const sw = Math.max(60, W / 14); for (let x = W; x > 0; x -= sw) g.quadraticCurveTo(x - sw / 2, vh * 1.5, x - sw, vh * 0.6);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,215,110,.55)'; for (let x = sw / 2; x < W; x += sw) { g.beginPath(); g.arc(W - x, vh * 1.05, 2.2, 0, 7); g.fill(); }
    // 비네트
    const vg2 = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    vg2.addColorStop(0, 'rgba(0,0,0,0)'); vg2.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg2; g.fillRect(0, 0, W, H);
    return c;
  }
  function frame(pn) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame); step(pn);
  }
  function step(pn) {
    const dt = Math.min(0.05, Math.max(0, (pn - S.lastPn) / 1000)), gapBig = pn - S.lastPn > 450; S.lastPn = pn;
    if (S.dirty) layout();
    const t = T(), tl = S.tl;
    // 사건
    tl.drums.forEach((d, i) => { if (t >= d[0]) fire('drum' + i, gapBig || t - d[0] > 0.4); });
    for (const r of [3, 2]) if (tl.reveal[r] != null && t >= tl.reveal[r]) fire('land' + r, gapBig || t - tl.reveal[r] > 0.5);
    if (tl.reveal[1] != null && t >= tl.reveal[1]) { fire('land1', true); fire('win', gapBig || t - tl.win > 0.6 || S.silentEnd); }
    if (t >= tl.table) { fire('table', gapBig || S.silentEnd); if (!S.tableOn && S.pageEls && S.pageEls.length) { S.tableOn = true; S.tbl.classList.add('on'); animRows(S.pageEls[S.page], 0.1); S.pageT = t; } else if (!S.tableOn && !S.P) { S.tableOn = true; S.tbl.classList.add('on'); } }
    if (!S.done && t >= tl.end) { S.done = true; S.doneAt = performance.now(); }
    S.seekSilent = false;
    if (S.tableOn && S.pageEls.length > 1) {
      const u = (t - S.pageT) / S.pageDur; const b = S.pgEl.querySelector('.cer-pbar b'); if (b) b.style.width = clamp(u, 0, 1) * 100 + '%';
      if (u >= 1) { S.pageT = t; flipPage(); }
    }
    S.skipEl.style.opacity = S.done ? 0 : 1;
    const mute = S.o.muted && S.o.muted(); if (S.bus) S.bus.gain.value = mute ? 0 : 0.9;
    draw(t, dt);
  }
  function draw(t, dt) {
    const ctx = S.ctx, W = S.W, H = S.H, D = S.DPR;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!S.bg) S.bg = bgCanvas();
    ctx.drawImage(S.bg, 0, 0);
    ctx.setTransform(D, 0, 0, D, 0, 0);
    const L = cur(), tl = S.tl, won = tl.win != null && t >= tl.win;
    // 반짝이는 별
    for (const s of S.stars) { const a = 0.25 + 0.55 * Math.max(0, Math.sin(t * s.sp + s.p)); ctx.fillStyle = `rgba(255,240,210,${a})`; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill(); }
    // 바닥
    const floor = L ? L.floor : S.y1;
    let fg = ctx.createLinearGradient(0, floor - H * 0.02, 0, H); fg.addColorStop(0, '#1d1640'); fg.addColorStop(1, '#07061a');
    ctx.fillStyle = fg; ctx.fillRect(0, floor - 1, W, H - floor + 1);
    ctx.fillStyle = 'rgba(255,220,140,.18)'; ctx.fillRect(0, floor - 1, W, 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // 1등 뒤 빛줄기
    if (L && won) {
      const a = Math.min(1, (t - tl.win) / 0.8), cx = L.cx[1], cy = feetY(L, 1) - L.s * 1.3, R = Math.max(W, H);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.18);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.7); rg.addColorStop(0, `rgba(255,214,110,${0.22 * a})`); rg.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.fillStyle = rg;
      for (let i = 0; i < 14; i++) { const a0 = (i / 14) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a0 + Math.PI / 28); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    // 핀 조명
    if (L) {
      for (const r of S.order) {
        const tr = tl.reveal[r]; if (tr == null || t < tr - 0.05) continue;
        const a = Math.min(1, (t - tr + 0.05) / 0.25) * (r === 1 ? 1 : 0.85);
        spot(ctx, L.cx[r], -H * 0.05, L.cx[r], feetY(L, r), L.cw * 0.42, MET[r].glow, a);
      }
      // 두구두구: 찾는 조명
      const drumming = !won && tl.drums.some(d => t >= d[0] && t < d[0] + d[1] + 0.35);
      if (drumming) for (let i = 0; i < 2; i++) {
        const sx = i ? W * 0.85 : W * 0.15, tx = W / 2 + Math.sin(t * (2.2 + i * 0.7) + i * 2) * W * 0.32;
        spot(ctx, sx, -H * 0.05, tx, floor - H * 0.04, L.cw * 0.3, 'rgba(190,210,255,', 0.6);
      }
    }
    ctx.restore();
    // 시상대 + 캐릭터
    if (L) {
      for (const r of [3, 2, 1]) if (L.cols[r]) drawBlock(ctx, L, r, t);
      for (const r of [3, 2, 1]) if (L.cols[r]) drawPerson(ctx, L, r, t);
      // 이름표 위치
      for (const r of S.order) {
        const el = S.plates[r], c = L.cols[r], top = feetY(L, r) - c.charK * L.s - H * 0.012;
        const key = `${L.cx[r] | 0},${L.pw | 0},${top | 0},${c.pfs.toFixed(1)}`;
        if (el._k !== key) { el._k = key; el.style.fontSize = c.pfs + 'px'; el.style.width = L.pw + 'px'; el.style.left = (L.cx[r] - L.pw / 2) + 'px'; el.style.bottom = (H - top) + 'px'; }
      }
      // 두구두구 글자
      const d = tl.drums.find(d => t >= d[0] && t < d[0] + d[1] + 0.3);
      if (d && !won) {
        const txt = S.P > 1 && d === tl.drums[tl.drums.length - 1] ? '대망의 1등은…?' : '두구두구두구…';
        const fs = clamp(H * 0.06, 22, 70), cx = L.cx[1], cy = feetY(L, 1) - L.s * 1.4;
        ctx.save(); ctx.font = `900 ${fs}px Pretendard, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const sc = 1 + Math.sin(t * 22) * 0.03; ctx.translate(cx, cy); ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, (t - d[0]) / 0.3); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(txt, 0, 0);
        ctx.fillStyle = '#fff2c4'; ctx.fillText(txt, 0, 0); ctx.restore();
      }
    }
    // 관중 실루엣
    crowd(ctx, t, won);
    // 먼지, 폭죽, 꽃가루
    for (let i = S.dust.length - 1; i >= 0; i--) { const p = S.dust[i]; p.life += dt; if (p.life > 0.7) { S.dust.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; ctx.fillStyle = `rgba(255,240,220,${0.45 * (1 - p.life / 0.7)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.life * 2), 0, 7); ctx.fill(); }
    if (won && S.nextRocket && t > S.nextRocket) { S.nextRocket = t + 1.6 + rnd() * 2.4; rocket(t - tl.win < 4.5 && !S.silentEnd); }
    if (S.trickleUntil && t < S.trickleUntil && rnd() < 0.5) rain(1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = S.rockets.length - 1; i >= 0; i--) { const r = S.rockets[i]; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += H * 0.5 * dt;
      ctx.fillStyle = 'rgba(255,230,180,.9)'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,90,.35)'; ctx.beginPath(); ctx.arc(r.x - r.vx * 0.03, r.y - r.vy * 0.03, 2, 0, 7); ctx.fill();
      if (r.y <= r.ty || r.vy >= 0) { S.rockets.splice(i, 1); explode(r); } }
    for (let i = S.sparks.length - 1; i >= 0; i--) { const p = S.sparks[i]; p.life += dt; if (p.life > p.max) { S.sparks.splice(i, 1); continue; }
      p.vx *= Math.pow(0.25, dt); p.vy = p.vy * Math.pow(0.25, dt) + H * 0.22 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 + 2.2 * a, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${S.flash * 0.25})`; ctx.fillRect(0, 0, W, H); S.flash = Math.max(0, S.flash - dt * 1.5); }
    ctx.restore();
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i]; p.life += dt; p.vy += H * 0.9 * dt; p.vx *= Math.pow(0.35, dt); p.vy = Math.min(p.vy, H * 0.26); p.x += p.vx * dt + Math.sin(p.life * 5 + p.a) * 30 * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.y > H + 20 || p.life > 10) { S.parts.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.cos(p.life * 8 + p.a)); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    }
  }
  function spot(ctx, sx, sy, tx, ty, wid, glow, a) {
    const g = ctx.createLinearGradient(sx, sy, tx, ty); g.addColorStop(0, glow + (0.0) + ')'); g.addColorStop(0.35, glow + (0.12 * a) + ')'); g.addColorStop(1, glow + (0.3 * a) + ')');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - wid * 0.06, sy); ctx.lineTo(sx + wid * 0.06, sy); ctx.lineTo(tx + wid * 0.5, ty); ctx.lineTo(tx - wid * 0.5, ty); ctx.closePath(); ctx.fill();
    const pg = ctx.createRadialGradient(tx, ty, 0, tx, ty, wid * 0.6); pg.addColorStop(0, glow + (0.45 * a) + ')'); pg.addColorStop(1, glow + '0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(tx, ty, wid * 0.6, wid * 0.16, 0, 0, 7); ctx.fill();
  }
  function drawBlock(ctx, L, r, t) {
    const m = MET[r], cx = L.cx[r], bw = L.cw * 0.86, top = blockTop(L, r), bot = L.floor, d = L.dpt;
    const lit = S.tl.reveal[r] != null && t >= S.tl.reveal[r] ? 1 : 0.45;
    ctx.save();
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, bot, bw * 0.6, Math.max(4, d * 0.5), 0, 0, 7); ctx.fill();
    // 윗면
    ctx.beginPath(); ctx.moveTo(cx - bw / 2, top); ctx.lineTo(cx + bw / 2, top); ctx.lineTo(cx + bw / 2 - d * 0.8, top - d); ctx.lineTo(cx - bw / 2 + d * 0.8, top - d); ctx.closePath();
    const tg = ctx.createLinearGradient(0, top - d, 0, top); tg.addColorStop(0, m.c[0]); tg.addColorStop(1, m.top); ctx.fillStyle = tg; ctx.fill();
    // 앞면
    const fg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    fg.addColorStop(0, m.c[3]); fg.addColorStop(0.12, m.c[2]); fg.addColorStop(0.35, m.c[1]); fg.addColorStop(0.5, m.c[0]); fg.addColorStop(0.68, m.c[1]); fg.addColorStop(0.9, m.c[2]); fg.addColorStop(1, m.c[3]);
    ctx.fillStyle = fg; ctx.fillRect(cx - bw / 2, top, bw, bot - top);
    const vg = ctx.createLinearGradient(0, top, 0, bot); vg.addColorStop(0, 'rgba(255,255,255,.18)'); vg.addColorStop(0.15, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = vg; ctx.fillRect(cx - bw / 2, top, bw, bot - top);
    // 반짝임 (지나가는 빛)
    const ph = ((t * 0.35 + r * 0.31) % 1.6) - 0.3;
    if (ph > -0.3 && ph < 1.3) {
      ctx.save(); ctx.beginPath(); ctx.rect(cx - bw / 2, top - d, bw, bot - top + d); ctx.clip();
      const sx = cx - bw / 2 + ph * bw, sg = ctx.createLinearGradient(sx - bw * 0.15, 0, sx + bw * 0.15, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.transform(1, 0, -0.35, 1, (top + bot) / 2 * 0.35, 0); ctx.fillRect(sx - bw * 0.2, top - d, bw * 0.4, bot - top + d); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - bw / 2, top + 0.5); ctx.lineTo(cx + bw / 2, top + 0.5); ctx.stroke();
    // 순위 숫자
    const h = bot - top, fs = Math.min(h * 0.7, bw * 0.45);
    if (fs > 10) {
      ctx.font = `900 ${fs}px Pretendard, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const ny = top + h * 0.52 + fs * 0.04;
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillText(String(r), cx, ny + fs * 0.035);
      ctx.fillStyle = m.txt; ctx.fillText(String(r), cx, ny);
    }
    if (lit < 1) { ctx.fillStyle = 'rgba(6,6,26,.45)'; ctx.beginPath(); ctx.moveTo(cx - bw / 2, top); ctx.lineTo(cx - bw / 2 + d * 0.8, top - d); ctx.lineTo(cx + bw / 2 - d * 0.8, top - d); ctx.lineTo(cx + bw / 2, top); ctx.lineTo(cx + bw / 2, bot); ctx.lineTo(cx - bw / 2, bot); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function drawPerson(ctx, L, r, t) {
    const tr = S.tl.reveal[r]; if (tr == null || t < tr - 0.42) return;
    const e = S.podium[r - 1], s = L.s, x = L.cx[r], fy = feetY(L, r), H = S.H, won = S.tl.win != null && t >= S.tl.win;
    let y = fy, sx = 1, sy = 1, pose = 'idle';
    const u = (t - (tr - 0.42)) / 0.42; // 떨어지기
    if (u < 1) y = fy - (1 - u * u) * (fy + s * 3);
    else {
      const v = (t - tr) / 0.28; if (v < 1) { const k = Math.sin(Math.PI * v); sy = 1 - 0.22 * k; sx = 1 + 0.16 * k; }
      if (won && t > S.tl.win + 0.15) {
        const w = t - S.tl.win;
        if (r === 1) { pose = 'cheer'; y = fy - Math.abs(Math.sin(w * Math.PI * 1.7)) * s * 0.45; }
        else { pose = 'clap'; y = fy - Math.abs(Math.sin(w * 6 + r)) * s * 0.06; }
      } else if (r !== 1 && t > tr + 0.3) pose = 'wave';
    }
    const face = r === 3 ? -1 : 1;
    const ph = t * 1 + r;
    const arms = pose === 'cheer' ? [2.55 + 0.3 * Math.sin(t * 9), -(2.55 + 0.3 * Math.sin(t * 9 + 1.3))]
      : pose === 'clap' ? (() => { const th = 1.05 + 0.32 * (0.5 + 0.5 * Math.sin(t * 15 + r)); return [-th, th]; })()
      : pose === 'wave' ? (face > 0 ? [0.15 * -1, -(2.4 + 0.35 * Math.sin(t * 7))] : [2.4 + 0.35 * Math.sin(t * 7), 0.15]) : null;
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); ctx.translate(-x, -y);
    const opts = Object.assign({ seed: e.id }, S.o.charOpts || {}, arms ? { arms } : {});
    try {
      if (S.o.drawCharacter) S.o.drawCharacter(ctx, x, y, s, e, ph, pose, face, opts);
      else if (window.IQ && IQ.drawChar) IQ.drawChar(ctx, x, y, s, e.color, ph, false, face, '', opts);
      else fallbackChar(ctx, x, y, s, e.color);
    } catch (err) { fallbackChar(ctx, x, y, s, e.color); }
    ctx.restore();
    if (r === 1 && t >= tr + 0.25) crown(ctx, x + face * s * 0.02, y - s * 2.08, s, t, Math.min(1, (t - tr - 0.25) / 0.35));
  }
  function fallbackChar(ctx, x, y, s, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - s * 0.8, s * 0.45, s * 0.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe0c4'; ctx.beginPath(); ctx.arc(x, y - s * 1.7, s * 0.55, 0, 7); ctx.fill(); }
  function crown(ctx, x, y, s, t, a) {
    const w = s * 1.0, h = s * 0.62; y -= (1 - easeOut(a)) * s * 2.5;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(-0.08 + Math.sin(t * 3) * 0.04);
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#fff3a6'); g.addColorStop(0.5, '#ffcf3a'); g.addColorStop(1, '#c48a0a');
    ctx.fillStyle = g; ctx.strokeStyle = '#7a4d00'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 - w * 0.04, -h); ctx.lineTo(-w * 0.25, -h * 0.45); ctx.lineTo(0, -h * 1.1); ctx.lineTo(w * 0.25, -h * 0.45); ctx.lineTo(w / 2 + w * 0.04, -h); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const [gx, gc] of [[-w * 0.27, '#ff4d6d'], [0, '#4fc3ff'], [w * 0.27, '#5fe08a']]) { ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(gx, -h * 0.2, s * 0.07, 0, 7); ctx.fill(); }
    for (const px of [-w / 2 - w * 0.04, 0, w / 2 + w * 0.04]) { ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(px, px ? -h : -h * 1.1, s * 0.06, 0, 7); ctx.fill(); }
    // 반짝
    const k = (Math.sin(t * 4) + 1) / 2; ctx.globalAlpha = a * k; ctx.fillStyle = '#fff';
    ctx.translate(w * 0.3, -h * 0.85); ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.05 : s * 0.2, an = i * Math.PI / 4; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function crowd(ctx, t, won) {
    const W = S.W, H = S.H, n = Math.ceil(W / 40), base = H + 4, hh = Math.min(H * 0.07, 60);
    ctx.save();
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = row ? '#0b0a1e' : '#15123a';
      for (let i = 0; i <= n; i++) {
        const x = (i + (row ? 0.5 : 0)) * (W / n), seed = (i * 7.3 + row * 3.1) % 1;
        const amp = won ? hh * 0.18 : hh * 0.04, b = Math.abs(Math.sin(t * (won ? 6 : 2) + i * 1.7 + row)) * amp;
        const y = base - row * hh * 0.28 - b, r = hh * (0.22 + ((i * 13) % 5) * 0.012);
        ctx.beginPath(); ctx.ellipse(x, y - hh * 0.2, r * 1.5, hh * 0.45, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - hh * 0.62, r, 0, 7); ctx.fill();
        if (won && (i + row) % 3 === 0) { // 손 흔들기
          const ang = Math.sin(t * 8 + i) * 0.4; ctx.save(); ctx.translate(x + r * 1.1, y - hh * 0.55); ctx.rotate(-0.3 + ang); ctx.fillRect(-r * 0.18, -hh * 0.55, r * 0.36, hh * 0.55); ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  // tick: (디버그) 화면이 숨겨져 rAF 가 멈춘 때 sec 초만큼 진행시켜 한 프레임 그림
  function tick(sec) { if (!S) return; S.freezeT = null; S.t0 -= (sec || 0) * 1000; S.lastPn = performance.now() - 16; step(performance.now()); }
  window.CEREMONY = { show, hide, skip, seek, tick, get showing() { return !!S; }, get state() { return S; } };
})();
