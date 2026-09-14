const app = document.querySelector('#app');

function injectStyles() {
  if (document.querySelector('#practice-enhance-style')) return;
  const style = document.createElement('style');
  style.id = 'practice-enhance-style';
  style.textContent = `
    .session-app.sumus-practice-live .session-header{position:relative;overflow:hidden}
    .session-app.sumus-practice-live .session-header::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,rgba(37,99,235,.32),transparent);transform:translateX(-100%);animation:sumusSweep 2.6s ease-in-out infinite}
    .sumus-practice-live .question-area{padding-bottom:max(28px,env(safe-area-inset-bottom))}
    .sumus-practice-live .question-prompt{letter-spacing:-.025em}
    .sumus-practice-live .option{transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease,background .14s ease}
    .sumus-practice-live .option:not(:disabled):active{transform:scale(.985)}
    .sumus-practice-live .answer-input{transition:border-color .16s ease,box-shadow .16s ease,background .16s ease}
    .sumus-practice-live .answer-input:focus{box-shadow:0 0 0 4px rgba(37,99,235,.08)}
    .sumus-practice-live .practice-score{display:flex;gap:8px;align-items:center}
    .sumus-practice-live .practice-score span{padding:5px 9px;border-radius:999px;background:#f2f4f7;color:#475467;font-weight:700}
    .sumus-practice-live .practice-score span.sumus-combo-hot{background:#fff7ed;color:#c2410c;animation:sumusComboPulse .42s ease}
    .sumus-practice-live .practice-score b{min-width:58px;text-align:right}
    .sumus-practice-live #practice-feedback{margin-top:18px}
    .sumus-practice-live .feedback{position:relative;overflow:hidden;border-radius:18px;padding:18px 18px 16px;box-shadow:0 8px 24px rgba(16,24,40,.06);animation:sumusFeedbackIn .24s ease-out}
    .sumus-practice-live .feedback:not(.wrong){border:1px solid #d1fadf;background:linear-gradient(180deg,#f6fef9,#fff)}
    .sumus-practice-live .feedback.wrong{border:1px solid #fee4e2;background:linear-gradient(180deg,#fff8f7,#fff)}
    .sumus-feedback-badge{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:20px;font-weight:900;margin-bottom:12px}
    .sumus-feedback-badge.ok{background:#dcfae6;color:#079455}
    .sumus-feedback-badge.no{background:#fee4e2;color:#d92d20}
    .sumus-feedback-kicker{display:block;margin:-6px 0 5px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3}
    .sumus-practice-live .feedback .gain{position:absolute;top:16px;right:17px;font-size:16px;font-weight:900;color:#1570ef}
    .sumus-practice-live .feedback .progress{height:7px;margin-top:14px}
    .sumus-practice-live #practice-next{min-height:54px;border-radius:15px;font-weight:800;box-shadow:0 8px 22px rgba(37,99,235,.16)}
    .sumus-practice-live .milestone-toast{position:relative;border:0;background:linear-gradient(135deg,#101828,#344054);color:#fff;border-radius:16px;padding:14px 16px;margin-top:10px;font-weight:800;box-shadow:0 10px 28px rgba(16,24,40,.16);animation:sumusMilestone .38s cubic-bezier(.2,.8,.2,1)}
    .sumus-practice-live .milestone-toast::before{content:"COMBO";display:block;font-size:10px;letter-spacing:.14em;opacity:.62;margin-bottom:4px}
    .sumus-practice-live .progress.sumus-progress-hit i{animation:sumusProgressHit .42s ease}
    .sumus-result-polish{position:relative;overflow:hidden}
    .sumus-result-polish .result-number{animation:sumusScorePop .42s cubic-bezier(.2,.85,.25,1.15)}
    .sumus-result-ribbon{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px 0 20px}
    .sumus-result-ribbon span{font-size:12px;font-weight:800;padding:7px 10px;border-radius:999px;background:#f2f4f7;color:#344054}
    .sumus-result-ribbon span.primary{background:#eff8ff;color:#175cd3}
    .sumus-float-point{position:fixed;z-index:70;pointer-events:none;font-weight:900;font-size:18px;color:#1570ef;animation:sumusFloatPoint .85s ease-out forwards}
    @keyframes sumusSweep{0%,35%{transform:translateX(-100%)}70%,100%{transform:translateX(100%)}}
    @keyframes sumusComboPulse{0%{transform:scale(.92)}70%{transform:scale(1.08)}100%{transform:scale(1)}}
    @keyframes sumusFeedbackIn{from{opacity:0;transform:translateY(7px) scale(.99)}to{opacity:1;transform:none}}
    @keyframes sumusMilestone{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes sumusProgressHit{0%{filter:brightness(1)}50%{filter:brightness(1.28)}100%{filter:brightness(1)}}
    @keyframes sumusScorePop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
    @keyframes sumusFloatPoint{0%{opacity:0;transform:translate(-50%,4px) scale(.8)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-46px) scale(1.05)}}
    @media(max-width:520px){.sumus-practice-live .question-area{padding-left:18px;padding-right:18px}.sumus-practice-live #practice-next{position:sticky;bottom:max(12px,env(safe-area-inset-bottom));z-index:4}}
    @media(prefers-reduced-motion:reduce){.sumus-practice-live *,.sumus-result-polish *{animation:none!important;transition:none!important}.session-app.sumus-practice-live .session-header::after{display:none}}
  `;
  document.head.appendChild(style);
}

function floatGain(feedback) {
  if (feedback.dataset.sumusFloated) return;
  const gain = feedback.querySelector('.gain')?.textContent?.trim();
  if (!gain || !gain.startsWith('+')) return;
  feedback.dataset.sumusFloated = '1';
  const rect = feedback.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'sumus-float-point';
  el.textContent = gain;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${Math.max(80, rect.top + 22)}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function enhancePractice() {
  const session = app.querySelector('.session-app');
  if (!session) return;
  const exit = session.querySelector('#practice-exit');
  if (!exit) return;
  session.classList.add('sumus-practice-live');

  const combo = session.querySelector('.practice-score span');
  if (combo) {
    const n = Number((combo.textContent.match(/\d+/) || [0])[0]);
    if (n >= 5) combo.classList.add('sumus-combo-hot');
  }

  const feedback = session.querySelector('.feedback');
  if (feedback && !feedback.querySelector('.sumus-feedback-badge')) {
    const ok = !feedback.classList.contains('wrong');
    const badge = document.createElement('div');
    badge.className = `sumus-feedback-badge ${ok ? 'ok' : 'no'}`;
    badge.textContent = ok ? '✓' : '↺';
    feedback.prepend(badge);
    const kicker = document.createElement('span');
    kicker.className = 'sumus-feedback-kicker';
    kicker.textContent = ok ? 'MASTERED +1' : 'RETRY QUEUED';
    badge.after(kicker);
    session.querySelector('.session-header .progress')?.classList.add('sumus-progress-hit');
    if (ok) floatGain(feedback);
  }

  const next = session.querySelector('#practice-next');
  if (next && !next.dataset.sumusEnhanced) {
    next.dataset.sumusEnhanced = '1';
    const finishedText = /마치기/.test(next.textContent || '');
    next.setAttribute('aria-label', finishedText ? '연습 결과 확인' : '다음 단어로 이동');
  }
}

function enhanceResult() {
  const page = app.querySelector('.result-page');
  if (!page || page.dataset.sumusResultEnhanced) return;
  if (!app.querySelector('#practice-home')) return;
  page.dataset.sumusResultEnhanced = '1';
  page.classList.add('sumus-result-polish');

  const stats = [...page.querySelectorAll('.record-stats > div')].map(x => ({ value: x.querySelector('strong')?.textContent?.trim(), label: x.querySelector('span')?.textContent?.trim() }));
  const ribbon = document.createElement('div');
  ribbon.className = 'sumus-result-ribbon';
  const accuracy = stats.find(x => x.label === '정답률')?.value;
  const combo = stats.find(x => x.label === '최고 연속')?.value;
  const level = stats.find(x => x.label === '현재 성장')?.value;
  ribbon.innerHTML = [accuracy && `<span class="primary">정답률 ${accuracy}</span>`, combo && `<span>최고 ${combo}연속</span>`, level && `<span>${level}</span>`].filter(Boolean).join('');
  const number = page.querySelector('.result-number');
  number?.after(ribbon);
}

function run() {
  injectStyles();
  enhancePractice();
  enhanceResult();
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; run(); });
});
observer.observe(app, { childList: true, subtree: true });
run();
