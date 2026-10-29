// V13.177 빈칸영작 연습 화면(중등 학습 → 빈칸영작, 중3 동아(윤정미) 5 · 6 · 7과 본문 암기노트 Step 1 ~ 5).
// V13.196 중2 YBM(박준언) 5 · 6 · 7과(100발100중 Reading)도 같은 화면이다. 단계 이름은 교과서마다(found.book.steps).
// 한 화면 = 본문 하나의 한 단계. 문항 = 영어 전문 + 우리말 해석(항상 보임). 채점과 보상은 서버(server/blank.mjs)가 다시 한다:
// 시작할 때 /blank/start, 끝나면 문항별 최종 답을 /blank/finish로 보내 보상(본문 × 단계 첫 완료만)을 받는다.
import { $, $$, esc, icon, toast, api, num } from './modules/ui.js';
import { blankGroup, blankSlots, blankSentences, blankAnswer, blankNorm, blankWords, blankDiff, blankTokens } from './modules/blank-rules.js';
import { BLANK_REWARDS, BLANK_DAILY_COINS } from './modules/rewards.js';
import { coinShower, coinReward, playReward, reducedMotion } from './modules/celebrate.js';

const STYLE_ID = 'bw-v13177-style';
function addStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bw{min-height:100svh;background:#f7f9fd;color:#101828;padding-bottom:128px;-webkit-font-smoothing:antialiased}
    .bw button,.bw textarea,.bw input{font-family:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .bw-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid #e8ecf3}
    .bw-topin{max-width:760px;margin:0 auto;padding:12px 16px 11px}
    .bw-nav{display:flex;align-items:center;gap:11px}
    .bw-back{width:40px;height:40px;flex:none;border:1px solid #e1e6ef;background:#fff;border-radius:13px;display:grid;place-items:center;color:#344054;box-shadow:0 2px 6px rgba(16,24,40,.05)}
    .bw-back .icon{width:19px;height:19px}
    .bw-meta{min-width:0;flex:1}
    .bw-meta strong{display:block;font-size:15px;line-height:1.25;font-weight:850;letter-spacing:-.25px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#172033}
    .bw-meta small{display:block;color:#8d99ad;font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bw-count{font-size:13px;font-weight:850;color:#344054;white-space:nowrap}
    .bw-progress{height:5px;background:#e9edf4;border-radius:999px;overflow:hidden;margin-top:11px}
    .bw-progress i{display:block;height:100%;background:linear-gradient(90deg,#3f6df3,#6d8ffa);border-radius:999px;transition:width .3s ease}
    .bw-main{max-width:760px;margin:0 auto;padding:16px 12px 22px}
    .bw-stagebar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 4px 12px}
    .bw-chip{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;background:#eef3ff;color:#2f5ee0;font-size:12.5px;font-weight:850}
    .bw-chip.ok{background:#e3f8ec;color:#067647}
    .bw-stagebar small{color:#667085;font-size:12.5px;font-weight:750}
    .bw-card{background:#fff;border:1px solid #e7ebf2;border-radius:22px;padding:18px 16px 16px;box-shadow:0 8px 24px rgba(16,24,40,.05)}
    .bw-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:11.5px;font-weight:900;letter-spacing:.06em;color:#7b8798}
    .bw-label span{letter-spacing:0;font-weight:800}
    .bw-ko{margin:0 0 16px;padding:12px 14px;border-radius:14px;background:#f4f7ff;color:#26324d;font-size:14.5px;line-height:1.6;font-weight:700;word-break:keep-all}
    .bw-en{font-size:19px;line-height:2.45;letter-spacing:-.2px;color:#172033;font-weight:600;word-break:normal;overflow-wrap:anywhere}
    .bw-tk{white-space:nowrap}
    .bw-slot{display:inline-block;vertical-align:baseline;min-width:3.2ch;height:36px;line-height:34px;padding:0 9px;margin:0 1px;border-bottom:3px solid #b8c4e0;background:#f4f7ff;border-radius:9px 9px 3px 3px;text-align:center;color:#3f6df3;font-weight:850;transition:background .2s,border-color .2s,transform .2s}
    .bw-slot.next{border-bottom-color:#3f6df3;background:#e9efff;box-shadow:0 0 0 3px rgba(63,109,243,.14)}
    .bw-slot.filled{background:#e3f8ec;border-bottom-color:#12b76a;color:#067647;animation:bw-pop .28s ease}
    .bw-slot .bw-first{opacity:.55;font-weight:800}
    .bw-slot.shake{animation:bw-shake .38s ease;border-bottom-color:#f04438;background:#fef3f2}
    .bw-in{display:inline-block;vertical-align:baseline;height:38px;padding:0 8px;margin:0 1px;border:2px solid #cfd8ec;border-radius:10px;background:#fff;color:#172033;font:inherit;font-size:18px;font-weight:700;text-align:center;outline:none;box-sizing:content-box;max-width:calc(100vw - 96px)}
    .bw-in::placeholder{color:#a5b0c6;font-weight:800}
    .bw-in:focus{border-color:#3f6df3;box-shadow:0 0 0 3px rgba(63,109,243,.16)}
    .bw-in.ok{border-color:#12b76a;background:#ecfdf3;color:#067647}
    .bw-in.bad{border-color:#f04438;background:#fef3f2;color:#b42318;animation:bw-shake .38s ease}
    .bw-in.shown{border-color:#f5b94f;background:#fffaeb;color:#93370d}
    .bw-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
    .bw-pick{min-height:46px;padding:0 15px;border:1.5px solid #d6def0;border-radius:14px;background:#fff;color:#172033;font-size:16.5px;font-weight:800;box-shadow:0 2px 0 #d6def0;transition:transform .12s,opacity .2s,box-shadow .12s}
    .bw-pick:active:not(:disabled){transform:translateY(2px);box-shadow:0 0 0 #d6def0}
    .bw-pick:disabled{opacity:.28;box-shadow:none;background:#f3f5f9}
    .bw-pick.shake{animation:bw-shake .38s ease;border-color:#f04438;background:#fef3f2}
    .bw-pick.hint{border-color:#3f6df3;background:#eef3ff;color:#2f5ee0}
    .bw-divider{height:1px;background:#edf0f6;margin:16px 0 13px}
    .bw-q{font-size:13px;font-weight:800;color:#667085;margin-bottom:10px}
    .bw-line{min-height:56px;padding:9px;border-radius:15px;background:#f4f7ff;border:1.5px dashed #c9d5f2;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
    .bw-line.ok{background:#ecfdf3;border:1.5px solid #b6e8cc}
    .bw-line.bad{background:#fef3f2;border:1.5px solid #fcc9c4;animation:bw-shake .38s ease}
    .bw-line .bw-pick{min-height:40px;font-size:15.5px;padding:0 12px;box-shadow:none}
    .bw-line.ok .bw-pick{border-color:#7fd6a5;color:#067647}
    .bw-line .bw-empty{color:#9aa6bd;font-size:13px;font-weight:700;padding:0 6px}
    .bw-sent{margin-bottom:14px}
    .bw-sent-label{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:850;color:#526075;margin:0 2px 7px}
    .bw-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .bw-tool{min-height:40px;padding:0 13px;border-radius:12px;border:1px solid #dfe5f1;background:#fff;color:#475467;font-size:13px;font-weight:800;display:inline-flex;align-items:center;gap:5px}
    .bw-tool:disabled{opacity:.35}
    .bw-tool.on{background:#fff7e8;border-color:#f5d9a0;color:#9a5b09}
    .bw-hintline{margin-top:12px;padding:10px 12px;border-radius:12px;background:#fff7e8;color:#8b5b13;font-size:14px;font-weight:750;line-height:1.7;word-break:break-all}
    .bw-hintline b{letter-spacing:.04em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .bw-area{width:100%;min-height:128px;padding:13px 14px;border:2px solid #cfd8ec;border-radius:15px;background:#fff;color:#172033;font-size:17px;line-height:1.6;font-weight:600;resize:vertical;outline:none;box-sizing:border-box}
    .bw-area:focus{border-color:#3f6df3;box-shadow:0 0 0 3px rgba(63,109,243,.16)}
    .bw-area.ok{border-color:#12b76a;background:#ecfdf3}
    .bw-area.bad{border-color:#f04438;background:#fffbfa;animation:bw-shake .38s ease}
    .bw-area:disabled{color:#067647}
    .bw-diff{margin-top:12px;display:grid;gap:9px}
    .bw-diffbox{padding:11px 13px;border-radius:13px;background:#f8f9fc;border:1px solid #e7ebf2;font-size:15px;line-height:1.75;font-weight:650}
    .bw-diffbox small{display:block;font-size:11px;font-weight:900;letter-spacing:.06em;color:#7b8798;margin-bottom:3px}
    .bw-diffbox .w{display:inline-block;margin-right:5px}
    .bw-diffbox .x{color:#b42318;background:#fee4e2;border-radius:6px;padding:0 4px;text-decoration:line-through;text-decoration-thickness:1.5px}
    .bw-diffbox .m{color:#b54708;background:#fef0c7;border-radius:6px;padding:0 4px;font-weight:850}
    .bw-diffbox .g{color:#067647}
    .bw-fb{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:12px 13px;border-radius:14px;background:#fef3f2;color:#b42318;font-size:13.5px;font-weight:750;line-height:1.55}
    .bw-fb.ok{background:#ecfdf3;color:#067647}
    .bw-fb i{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:currentColor;font-style:normal;font-size:13px}
    .bw-fb i b{color:#fff}
    .bw-fb .ans{display:block;margin-top:3px;color:#26324d;font-weight:650}
    .bw-bottom{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(255,255,255,.96);border-top:1px solid #e8ecf3;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .bw-bottomin{max-width:760px;margin:0 auto;padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:flex;gap:9px}
    .bw-bottom .btn{flex:1;min-height:54px;border-radius:15px;font-size:16px;font-weight:850}
    .bw-bottom .btn:disabled{opacity:.45}
    .bw-result{text-align:center;padding:26px 14px 22px;position:relative;overflow:hidden}
    .bw-mark{width:84px;height:84px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#12b76a,#32d583);color:#fff;font-size:42px;font-weight:900;box-shadow:0 12px 30px rgba(18,183,106,.32);animation:bw-mark .6s cubic-bezier(.2,1.4,.4,1)}
    .bw-result h1{margin:0 0 4px;font-size:23px;letter-spacing:-.4px}
    .bw-result p{margin:0;color:#667085;font-size:13.5px;font-weight:650}
    .bw-score{margin:16px 0 14px;font-size:54px;line-height:1;font-weight:950;letter-spacing:-1.5px;color:#3f6df3}
    .bw-score small{font-size:15px;letter-spacing:0;font-weight:800;color:#8d99ad;margin-left:4px}
    .bw-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
    .bw-stats div{padding:11px 4px;border-radius:14px;background:#f4f7ff}
    .bw-stats b{display:block;font-size:19px;font-weight:900;color:#172033}
    .bw-stats span{display:block;margin-top:2px;font-size:11.5px;font-weight:750;color:#7b8798}
    .bw-prize{min-height:92px;display:grid;place-items:center;gap:8px;padding:14px;border-radius:18px;background:#fffaf0;border:1px solid #f9e3b0}
    .bw-prize.plain{background:#f4f7ff;border-color:#e0e8fb}
    .bw-prize .xp{display:inline-flex;align-items:center;height:30px;padding:0 13px;border-radius:999px;background:#eef3ff;color:#2f5ee0;font-size:13.5px;font-weight:900}
    .bw-prize p{font-size:13px;color:#526075;font-weight:700;line-height:1.55}
    .bw-prize .btn{min-height:42px;border-radius:12px;font-size:14px}
    .bw-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
    .bw-confetti i{position:absolute;top:-14px;left:var(--x);width:9px;height:14px;border-radius:2px;background:var(--c);opacity:0;animation:bw-fall var(--t) ease-in var(--d) forwards}
    @keyframes bw-fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(420px) rotate(var(--r));opacity:0}}
    @keyframes bw-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
    @keyframes bw-pop{0%{transform:scale(.86)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
    @keyframes bw-mark{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
    @media(prefers-reduced-motion:reduce){.bw *{animation:none!important;transition:none!important}}
    @media(max-width:390px){
      .bw-main{padding-left:10px;padding-right:10px}
      .bw-card{padding:16px 13px 14px}
      .bw-en{font-size:17.5px}
      .bw-in{font-size:17px}
      .bw-pick{font-size:15.5px;padding:0 13px}
    }
  `;
  document.head.appendChild(style);
}

const splitTok = tok => { const m = /^([^\w]*)([\s\S]*?)([^\w]*)$/.exec(tok); return { pre: m[1], core: m[2], suf: m[3] }; };
const MESSAGES = {
  again: '이미 보상을 받은 단계예요. 연습은 끝났어요!',
  short: '너무 빨리 끝나서 이번에는 보상이 없어요. 연습은 끝났어요!',
  wrong: '서버 채점에서 답이 맞지 않아 보상이 없어요. 연습은 끝났어요!',
  nostart: '시작 기록을 찾지 못해 보상이 없어요. 연습은 끝났어요!',
  error: '연결이 불안정해서 보상을 확인하지 못했어요. 연습은 끝났어요!',
  forbidden: '중등 학생만 보상을 받을 수 있어요. 연습은 끝났어요!'
};

export function openBlankWriting(A, { group: groupId, step }, onExit) {
  const found = blankGroup(groupId);
  if (!found || !found.items.length || ![1, 2, 3, 4, 5].includes(step) || A.data.profile.division !== 'middle') { toast('빈칸영작 자료를 확인해주세요.'); return; }
  addStyles();
  A.screen = 'blank-writing';
  const { items, group } = found;
  const stepName = found.book.steps[step];
  const t0 = Date.now();
  let runId = null;
  const started = api('/blank/start', { group: group.id, step }).then(r => { runId = r.id; }).catch(() => { runId = null; });

  // ----- 문항별 상태 -----
  const makeState = item => {
    const st = { done: false, shown: false, hint: false, first: {} };
    if (step === 1) Object.assign(st, { fill: blankSlots(item, 1).map(() => null), shake: null });
    else if (step <= 3) Object.assign(st, { typed: blankSlots(item, step).map(() => ''), ok: blankSlots(item, step).map(() => false), bad: blankSlots(item, step).map(() => false) });
    else if (step === 4) st.sents = item.s4.map(chunks => ({ chunks, line: [], status: null, reveal: false }));
    else Object.assign(st, { typed: '', status: null, tries: 0 });
    return st;
  };
  const states = items.map(makeState);
  let index = 0;
  const unitsOf = item => step === 4 ? item.s4.length : step === 5 ? 1 : blankSlots(item, step).length;
  const totalUnits = items.reduce((n, item) => n + unitsOf(item), 0);

  const cur = () => ({ item: items[index], st: states[index] });
  const exit = () => {
    if (states.some(s => s.done) && !result && !confirm('나가면 지금까지 푼 것이 사라져요. 나갈까요?')) return;
    A.screen = null; onExit();
  };
  let result = null;

  function shell(sub, label, percent, body, bottom) {
    $('#app').innerHTML = `<div class="bw">
      <header class="bw-top"><div class="bw-topin">
        <div class="bw-nav"><button class="bw-back" id="bw-back" aria-label="나가기">${icon('back')}</button><div class="bw-meta"><strong>${esc(group.number)} · ${esc(group.title)}</strong><small>${esc(sub)}</small></div><div class="bw-count">${esc(label)}</div></div>
        <div class="bw-progress"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>
      </div></header>
      <main class="bw-main">${body}</main>
      <div class="bw-bottom"><div class="bw-bottomin">${bottom}</div></div>
    </div>`;
    $('#bw-back').onclick = exit;
  }

  // ----- 영어 문장(Step 1 ~ 3: 빈칸) -----
  function blankLine(item, st) {
    const tokens = blankTokens(item), slots = blankSlots(item, step), nextSlot = step === 1 ? st.fill.findIndex(v => v === null) : -1;
    return tokens.map((tok, i) => {
      const k = slots.indexOf(i);
      if (k < 0) return `<span class="bw-tk">${esc(tok)}</span>`;
      const { pre, core, suf } = splitTok(tok), len = Math.max(2, core.length);
      let mid;
      if (step === 1) {
        const filled = st.fill[k] !== null;
        const first = st.hint && !filled && k === nextSlot ? `<span class="bw-first">${esc(core[0])}</span>` : '';
        mid = `<span class="bw-slot${filled ? ' filled' : ''}${k === nextSlot ? ' next' : ''}${st.shake === k ? ' shake' : ''}" style="min-width:calc(${len}ch + 18px)">${filled ? esc(core) : first}</span>`;
      } else {
        const cls = st.shown && st.ok[k] && st.first[k] === 'bad' ? 'shown' : st.ok[k] ? 'ok' : st.bad[k] ? 'bad' : '';
        mid = `<input class="bw-in ${cls}" data-slot="${k}" value="${esc(st.typed[k])}" ${st.ok[k] ? 'readonly' : ''} placeholder="${st.hint && !st.ok[k] ? esc(core[0]) : ''}" style="width:calc(${len}ch + 8px)" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="${k === slots.length - 1 ? 'done' : 'next'}" aria-label="빈칸 ${k + 1}">`;
      }
      return `<span class="bw-tk">${esc(pre)}${mid}${esc(suf)}</span>`;
    }).join(' ');
  }

  const firstChunk = (answer, chunk) => { const a = blankWords(answer).join(' '), c = blankWords(chunk).join(' '); return a === c || a.startsWith(c + ' '); };
  function hintPattern(text) {
    return text.split(/\s+/).filter(Boolean).map(w => { const { pre, core, suf } = splitTok(w); return esc(pre) + (core ? esc(core[0]) + '_'.repeat(Math.max(0, core.length - 1)) : '') + esc(suf); }).join(' ');
  }

  function feedbackFor(item, st) {
    if (!st.done) return '';
    const answer = esc(item.en);
    return st.shown
      ? `<div class="bw-fb"><i><b>!</b></i><div>정답을 확인했어요.<span class="ans">${answer}</span></div></div>`
      : `<div class="bw-fb ok"><i><b>✓</b></i><div>정답이에요!</div></div>`;
  }

  // ----- 단계별 본문 -----
  function stageBody(item, st) {
    const ko = `<p class="bw-ko">${esc(item.ko)}</p>`;
    if (step === 1) {
      const chips = item.o1.map((word, c) => `<button class="bw-pick${st.shakeChip === c ? ' shake' : ''}" data-chip="${c}" ${st.used?.has(c) || st.done ? 'disabled' : ''}>${esc(word)}</button>`).join('');
      return `${ko}<div class="bw-en">${blankLine(item, st)}</div>
        <div class="bw-divider"></div><div class="bw-q">${st.done ? '모두 채웠어요!' : '보기를 눌러 빈칸을 차례로 채워요'}</div>
        <div class="bw-chips">${chips}</div>`;
    }
    if (step === 2 || step === 3) {
      return `${ko}<div class="bw-en">${blankLine(item, st)}</div>`;
    }
    if (step === 4) {
      return `${ko}${st.sents.map((sent, k) => {
        const answer = blankSentences(item)[k];
        const lineCls = sent.status === 'ok' ? 'ok' : sent.status === 'bad' ? 'bad' : '';
        const line = sent.reveal ? answer.split(' ').map(w => `<span class="bw-pick" style="pointer-events:none">${esc(w)}</span>`).join('')
          : sent.line.length ? sent.line.map((c, n) => `<button class="bw-pick" data-line="${k}:${n}" ${sent.status === 'ok' ? 'disabled' : ''}>${esc(sent.chunks[c])}</button>`).join('') : '<span class="bw-empty">단어를 눌러 순서대로 쌓아요</span>';
        const pool = sent.chunks.map((chunk, c) => `<button class="bw-pick${st.hint && !sent.line.length && !sent.reveal && sent.status !== 'ok' && firstChunk(answer, chunk) ? ' hint' : ''}" data-pool="${k}:${c}" ${sent.line.includes(c) || sent.reveal || sent.status === 'ok' ? 'disabled' : ''}>${esc(chunk)}</button>`).join('');
        return `<div class="bw-sent"><div class="bw-sent-label"><span>${item.s4.length > 1 ? `문장 ${k + 1}` : '문장'}</span>${sent.status === 'ok' ? '<span style="color:#067647">✓ 정답</span>' : sent.status === 'bad' ? '<span style="color:#b42318">순서가 달라요</span>' : ''}</div>
          <div class="bw-line ${lineCls}">${line}</div>
          <div class="bw-chips">${pool}</div>
          ${sent.status === 'ok' || sent.reveal ? '' : `<div class="bw-tools"><button class="bw-tool" data-undo="${k}" ${sent.line.length ? '' : 'disabled'}>↶ 되돌리기</button><button class="bw-tool" data-reset="${k}" ${sent.line.length ? '' : 'disabled'}>처음부터</button></div>`}
        </div>`;
      }).join('')}`;
    }
    const diff = st.status === 'bad' && st.diff ? `<div class="bw-diff">
      <div class="bw-diffbox"><small>내가 쓴 글</small>${st.diff.mine.map(w => `<span class="w ${w.ok ? 'g' : 'x'}">${esc(w.word)}</span>`).join('') || '(비어 있어요)'}</div>
      <div class="bw-diffbox"><small>빠졌거나 다른 부분</small>${st.diff.want.map(w => `<span class="w ${w.ok ? 'g' : 'm'}">${esc(w.word)}</span>`).join('')}</div></div>` : '';
    return `${ko}<textarea class="bw-area ${st.status === 'ok' ? 'ok' : st.status === 'bad' ? 'bad' : ''}" id="bw-area" rows="4" placeholder="우리말을 보고 영어로 써요" autocapitalize="sentences" autocorrect="off" autocomplete="off" spellcheck="false" ${st.done ? 'disabled' : ''}>${esc(st.typed)}</textarea>${diff}`;
  }

  function hintText(item, st) {
    if (!st.hint || st.done) return '';
    if (step === 5) return `<div class="bw-hintline">첫 글자 힌트<br><b>${hintPattern(item.en)}</b></div>`;
    if (step === 4) return `<div class="bw-hintline">첫 단어 힌트: ${blankSentences(item).map(s => `<b>${esc(splitTok(s.split(' ')[0]).core || s.split(' ')[0])}</b>`).join(' · ')}</div>`;
    return '';
  }

  function mountItem() {
    const { item, st } = cur();
    const doneCount = states.filter(s => s.done).length;
    const last = index === items.length - 1;
    const needsCheck = step >= 2;
    const body = `
      <div class="bw-stagebar"><div><span class="bw-chip${st.done ? ' ok' : ''}">${esc(stepName)}</span></div><small>${doneCount}/${items.length} 문항 완료</small></div>
      <section class="bw-card">
        <div class="bw-label"><b>${esc(String(item.n).padStart(2, '0'))}</b><span>${index + 1} / ${items.length}</span></div>
        ${stageBody(item, st)}
        ${hintText(item, st)}
        ${feedbackFor(item, st)}
        ${st.done ? '' : `<div class="bw-tools"><button class="bw-tool${st.hint ? ' on' : ''}" id="bw-hint">💡 첫 글자 힌트</button><button class="bw-tool" id="bw-show">정답 보기</button></div>`}
      </section>`;
    const bottom = st.done
      ? `<button class="btn primary" id="bw-next">${last ? '결과 보기' : '다음 문항'} ${icon('arrow')}</button>`
      : needsCheck ? '<button class="btn primary" id="bw-check">확인</button>' : '<button class="btn" disabled>보기를 눌러 채워요</button>';
    shell(`${stepName}`, `${index + 1} / ${items.length}`, (doneCount / items.length) * 100, body, bottom);
    bindItem();
  }

  // 입력이 있는 화면은 입력 중에는 다시 그리지 않고, 버튼을 누를 때만 다시 그린다.
  function bindItem() {
    const { item, st } = cur();
    $('#bw-hint')?.addEventListener('click', () => { st.hint = !st.hint; mountItem(); });
    $('#bw-show')?.addEventListener('click', () => reveal(item, st));
    $('#bw-next')?.addEventListener('click', () => { if (index >= items.length - 1) return finish(); index++; mountItem(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#bw-check')?.addEventListener('click', () => check(item, st));
    if (step === 1) $$('[data-chip]').forEach(btn => btn.addEventListener('click', () => pickChip(item, st, Number(btn.dataset.chip))));
    if (step === 2 || step === 3) {
      const inputs = $$('.bw-in');
      inputs.forEach(input => {
        input.addEventListener('input', () => { st.typed[Number(input.dataset.slot)] = input.value; st.bad[Number(input.dataset.slot)] = false; input.classList.remove('bad'); });
        input.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const open = inputs.filter(x => !x.readOnly), at = open.indexOf(input);
          if (at >= 0 && at < open.length - 1) open[at + 1].focus(); else check(item, st);
        });
      });
      (inputs.find(x => !x.readOnly && !x.value) || inputs.find(x => !x.readOnly))?.focus({ preventScroll: true });
    }
    if (step === 4) {
      $$('[data-pool]').forEach(btn => btn.addEventListener('click', () => { const [k, c] = btn.dataset.pool.split(':').map(Number); const sent = st.sents[k]; sent.line.push(c); sent.status = null; mountItem(); }));
      $$('[data-line]').forEach(btn => btn.addEventListener('click', () => { const [k, n] = btn.dataset.line.split(':').map(Number); const sent = st.sents[k]; sent.line.splice(n, 1); sent.status = null; mountItem(); }));
      $$('[data-undo]').forEach(btn => btn.addEventListener('click', () => { const sent = st.sents[Number(btn.dataset.undo)]; sent.line.pop(); sent.status = null; mountItem(); }));
      $$('[data-reset]').forEach(btn => btn.addEventListener('click', () => { const sent = st.sents[Number(btn.dataset.reset)]; sent.line = []; sent.status = null; mountItem(); }));
    }
    if (step === 5) {
      const area = $('#bw-area');
      area?.addEventListener('input', () => { st.typed = area.value; if (st.status === 'bad') { area.classList.remove('bad'); } });
      area?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(item, st); } });
      if (area && !st.done) area.focus({ preventScroll: true });
    }
  }

  // ----- 동작 -----
  function pickChip(item, st, c) {
    const slots = blankSlots(item, 1), tokens = blankTokens(item);
    const k = st.fill.findIndex(v => v === null);
    if (k < 0) return;
    st.used ||= new Set();
    const good = blankNorm(item.o1[c]) === blankNorm(tokens[slots[k]]);
    st.first[k] ??= good ? 'ok' : 'bad';
    if (good) {
      st.fill[k] = c; st.used.add(c); st.shakeChip = null; st.shake = null;
      if (st.fill.every(v => v !== null)) st.done = true;
      mountItem();
    } else {
      st.shakeChip = c; st.shake = k;
      mountItem();
      try { navigator.vibrate?.(40); } catch {}
      st.shakeChip = null; st.shake = null;
    }
  }

  function check(item, st) {
    if (st.done) return;
    if (step === 2 || step === 3) {
      const answers = blankAnswer(item, step);
      const empty = st.typed.findIndex((v, k) => !st.ok[k] && !blankNorm(v));
      if (empty >= 0) { toast('빈칸을 모두 채워 주세요.'); $$('.bw-in')[empty]?.focus(); return; }
      st.typed.forEach((value, k) => {
        if (st.ok[k]) return;
        const good = blankNorm(value) === blankNorm(answers[k]);
        st.first[k] ??= good ? 'ok' : 'bad';
        st.ok[k] = good; st.bad[k] = !good;
      });
      if (st.ok.every(Boolean)) st.done = true;
    } else if (step === 4) {
      const answers = blankSentences(item);
      if (st.sents.some(sent => sent.status !== 'ok' && sent.line.length < sent.chunks.length)) { toast('단어를 모두 놓아 주세요.'); return; }
      st.sents.forEach((sent, k) => {
        if (sent.status === 'ok') return;
        const good = blankWords(sent.line.map(c => sent.chunks[c]).join(' ')).join(' ') === blankWords(answers[k]).join(' ');
        st.first[k] ??= good ? 'ok' : 'bad';
        sent.status = good ? 'ok' : 'bad';
      });
      if (st.sents.every(s => s.status === 'ok')) st.done = true;
    } else {
      const given = st.typed.trim();
      if (!given) { toast('영어로 써 주세요.'); return; }
      const good = blankWords(given).join(' ') === blankWords(item.en).join(' ');
      st.first[0] ??= good ? 'ok' : 'bad';
      st.tries++;
      st.status = good ? 'ok' : 'bad';
      st.diff = good ? null : blankDiff(item.en, given);
      if (good) st.done = true;
    }
    mountItem();
    if (!st.done) { try { navigator.vibrate?.(30); } catch {} }
  }

  function reveal(item, st) {
    if (st.done) return;
    const n = unitsOf(item);
    for (let k = 0; k < n; k++) st.first[k] ??= 'bad';
    if (step === 1) {
      const slots = blankSlots(item, 1), tokens = blankTokens(item);
      st.used ||= new Set();
      st.fill.forEach((v, k) => {
        if (v !== null) return;
        const c = item.o1.findIndex((w, j) => !st.used.has(j) && blankNorm(w) === blankNorm(tokens[slots[k]]));
        st.fill[k] = c; st.used.add(c);
      });
    } else if (step <= 3) {
      const answers = blankAnswer(item, step);
      st.typed = st.typed.map((v, k) => st.ok[k] ? v : splitTok(answers[k]).core);
      st.ok = st.ok.map(() => true); st.bad = st.bad.map(() => false);
    } else if (step === 4) {
      st.sents.forEach(sent => { if (sent.status !== 'ok') { sent.reveal = true; sent.status = 'ok'; } });
    } else {
      st.typed = item.en; st.status = 'ok'; st.diff = null;
    }
    st.done = true; st.shown = true;
    mountItem();
  }

  // ----- 마무리 -----
  function finalAnswers() {
    const out = {};
    items.forEach((item, i) => {
      const st = states[i];
      if (step === 1) { const slots = blankSlots(item, 1); out[item.n] = slots.map((pos, k) => item.o1[st.fill[k]]); }
      else if (step <= 3) out[item.n] = st.typed.slice();
      else if (step === 4) out[item.n] = st.sents.map((sent, k) => sent.reveal ? blankSentences(item)[k] : sent.line.map(c => sent.chunks[c]).join(' '));
      else out[item.n] = st.typed;
    });
    return out;
  }
  const firstRight = () => states.reduce((n, st) => n + Object.values(st.first).filter(v => v === 'ok').length, 0);

  async function finish() {
    const ms = Date.now() - t0, right = firstRight(), rate = Math.round((right / totalUnits) * 100);
    result = { ms, right, rate, reply: null, pending: true };
    mountResult();
    await sendFinish();
  }
  async function sendFinish() {
    result.pending = true; result.reply = null;
    mountResult();
    try {
      await started;
      if (!runId) { result.reply = { paid: false, reason: 'nostart' }; }
      else result.reply = await api('/blank/finish', { id: runId, group: group.id, step, answers: finalAnswers(), first_rate: result.rate });
    } catch (err) {
      result.reply = { paid: false, reason: err?.status === 403 ? 'forbidden' : 'error' };
    }
    result.pending = false;
    const res = result.reply;
    if (res.done) A.data.rewards = { ...(A.data.rewards || {}), blank: { done: res.done, rate: res.rate || {}, left: res.left, daily: res.daily } };
    if (res.stats && A.data.stats) Object.assign(A.data.stats, res.stats);
    mountResult();
  }

  const fmtTime = ms => { const s = Math.max(1, Math.round(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };
  function prizeBlock() {
    const r = result.reply;
    if (result.pending) return '<div class="bw-prize plain"><p>서버에서 채점하고 있어요…</p></div>';
    if (r.paid) {
      const reward = BLANK_REWARDS[step];
      return `<div class="bw-prize" id="bw-prize">${r.coins > 0 ? coinReward(r.coins) : ''}<span class="xp">+${num(r.xp)} 경험치</span>
        ${r.capped ? `<p>${r.coins > 0 ? `오늘 빈칸영작 코인 상한(${BLANK_DAILY_COINS})까지 채워서 ${r.coins}코인만 받았어요.` : `오늘 빈칸영작 코인 상한(${BLANK_DAILY_COINS})을 채워서 경험치만 받았어요.`}</p>` : `<p>이 단계의 첫 완료 보상이에요. (${reward.coins}코인 · ${reward.xp}경험치)</p>`}</div>`;
    }
    return `<div class="bw-prize plain"><p>${esc(MESSAGES[r.reason] || MESSAGES.error)}</p>${r.reason === 'error' ? '<button class="btn" id="bw-retry">보상 다시 확인</button>' : ''}</div>`;
  }
  function mountResult() {
    const total = totalUnits, wrong = total - result.right;
    const body = `<section class="bw-card bw-result">
      <div class="bw-confetti" aria-hidden="true">${reducedMotion() ? '' : Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37 + 11) % 100}%;--c:${['#3f6df3', '#12b76a', '#f5b94f', '#f04438', '#7f56d9'][i % 5]};--d:${(i % 9) * 90}ms;--t:${1500 + (i % 5) * 260}ms;--r:${(i % 2 ? 1 : -1) * (240 + i * 20)}deg"></i>`).join('')}</div>
      <div class="bw-mark">✓</div>
      <h1>${esc(group.number)} ${esc(stepName.split(' · ')[0])} 완료!</h1>
      <p>${esc(stepName.split(' · ')[1] || '')} · ${items.length}문항을 모두 맞혔어요.</p>
      <div class="bw-score">${result.rate}<small>% · 1차 정답률</small></div>
      <div class="bw-stats"><div><b>${result.right}</b><span>1차 정답</span></div><div><b>${wrong}</b><span>다시 푼 칸</span></div><div><b>${fmtTime(result.ms)}</b><span>걸린 시간</span></div></div>
      ${prizeBlock()}
    </section>`;
    const next = step < 5 && !result.pending ? `<button class="btn primary" id="bw-nextstep">Step ${step + 1} 이어서 ${icon('arrow')}</button>` : '';
    const bottom = `<button class="btn" id="bw-list">단계 고르기</button>${next || `<button class="btn primary" id="bw-again" ${result.pending ? 'disabled' : ''}>한 번 더 풀기</button>`}`;
    shell('결과', '완료', 100, body, bottom);
    $('#bw-list')?.addEventListener('click', () => { A.screen = null; onExit(); });
    $('#bw-nextstep')?.addEventListener('click', () => { A.screen = null; openBlankWriting(A, { group: group.id, step: step + 1 }, onExit); });
    $('#bw-again')?.addEventListener('click', () => { A.screen = null; openBlankWriting(A, { group: group.id, step }, onExit); });
    $('#bw-retry')?.addEventListener('click', () => { void sendFinish(); });
    if (!result.pending && result.reply?.paid) {
      const prize = $('#bw-prize');
      playReward(prize, 350);
      if (result.reply.coins > 0) coinShower($('.bw-result'), 22, 2);
      try { navigator.vibrate?.([30, 40, 60]); } catch {}
    }
  }

  mountItem();
  window.scrollTo(0, 0);
}
