const app = document.querySelector('#app');

function injectStyles() {
  if (document.querySelector('#practice-enhance-style')) return;
  const style = document.createElement('style');
  style.id = 'practice-enhance-style';
  style.textContent = `
    .session-app.sumus-practice-live .session-header{position:relative;overflow:hidden}
    .session-app.sumus-practice-live .session-header::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,rgba(37,99,235,.32),transparent);transform:translateX(-100%);animation:sumusSweep 2.6s ease-in-out infinite}
    .sumus-practice-live .question-area{padding-bottom:max(28px,env(safe-area-inset-bottom))}
    .mode-option:first-child{flex-wrap:wrap}
    .mode-option .mode-help{flex-basis:100%;padding-left:25px;margin-top:-4px;font-size:10px;font-weight:500;color:#7b89aa}
    .practice-amount{margin-top:22px}
    .practice-target-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}
    .practice-target-grid button{min-height:54px;border:1px solid #dfe4ec;border-radius:14px;background:#fff;color:#344054;font-size:17px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:4px;transition:.16s ease}
    .practice-target-grid button small{font-size:10px;font-weight:550;color:#98a2b3}
    .practice-target-grid button.all{grid-column:1/-1;min-height:62px;flex-direction:column;gap:3px}
    .practice-target-grid button.all b{font-size:14px}
    .practice-target-grid button.selected{border:2px solid #6f91ed;background:#eef3ff;color:#315ac7;box-shadow:0 7px 18px rgba(49,90,199,.12)}
    .practice-target-grid button.selected small{color:#5875bd}
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
    .sumus-practice-live .feedback{position:relative;overflow:hidden;border-radius:22px;padding:22px 20px 18px;box-shadow:0 12px 32px rgba(16,24,40,.09);animation:sumusFeedbackIn .3s cubic-bezier(.2,.9,.25,1.15)}
    .sumus-practice-live .feedback:not(.wrong){border:2px solid #6ce9a6;background:linear-gradient(145deg,#ecfdf3,#fff 72%);box-shadow:0 16px 38px rgba(18,183,106,.18)}
    .sumus-practice-live .feedback.wrong{border:1px solid #fee4e2;background:linear-gradient(180deg,#fff8f7,#fff)}
    .sumus-feedback-badge{width:58px;height:58px;border-radius:19px;display:grid;place-items:center;font-size:30px;font-weight:900;margin-bottom:14px}
    .sumus-feedback-badge.ok{background:linear-gradient(135deg,#12b76a,#039855);color:#fff;box-shadow:0 9px 20px rgba(18,183,106,.28)}
    .sumus-feedback-badge.no{background:#fee4e2;color:#d92d20}
    .sumus-feedback-kicker{display:block;margin:-5px 0 6px;font-size:11px;font-weight:900;letter-spacing:.08em;color:#079455}
    .sumus-practice-live .feedback>b{font-size:19px;letter-spacing:-.02em}
    .sumus-practice-live .feedback .gain{position:absolute;top:20px;right:19px;font-size:21px;font-weight:950;color:#1570ef}
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
    .sumus-correct-burst{position:fixed;inset:0;z-index:65;pointer-events:none;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at center,rgba(18,183,106,.24),rgba(18,183,106,0) 52%);animation:sumusBurstFade .86s ease-out forwards}
    .sumus-correct-burst strong{display:grid;place-items:center;width:126px;height:126px;border-radius:40px;background:linear-gradient(145deg,#12b76a,#027a48);color:#fff;font-size:29px;letter-spacing:-.04em;box-shadow:0 24px 70px rgba(2,122,72,.38),inset 0 1px 0 rgba(255,255,255,.45);animation:sumusBurstPop .72s cubic-bezier(.18,.9,.24,1.18)}
    .sumus-correct-burst i{position:absolute;left:50%;top:50%;width:10px;height:20px;border-radius:99px;background:#32d583;transform:translate(-50%,-50%) rotate(var(--r)) translateY(-94px);animation:sumusSpark .78s ease-out forwards}
    .session-app.sumus-correct-hit .question-area{animation:sumusAreaHit .5s ease-out}
    @keyframes sumusSweep{0%,35%{transform:translateX(-100%)}70%,100%{transform:translateX(100%)}}
    @keyframes sumusComboPulse{0%{transform:scale(.92)}70%{transform:scale(1.08)}100%{transform:scale(1)}}
    @keyframes sumusFeedbackIn{from{opacity:0;transform:translateY(7px) scale(.99)}to{opacity:1;transform:none}}
    @keyframes sumusMilestone{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes sumusProgressHit{0%{filter:brightness(1)}50%{filter:brightness(1.28)}100%{filter:brightness(1)}}
    @keyframes sumusScorePop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
    @keyframes sumusFloatPoint{0%{opacity:0;transform:translate(-50%,4px) scale(.8)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-46px) scale(1.05)}}
    @keyframes sumusBurstPop{0%{opacity:0;transform:scale(.35) rotate(-8deg)}44%{opacity:1;transform:scale(1.12) rotate(2deg)}100%{opacity:0;transform:scale(1)}}
    @keyframes sumusBurstFade{0%,58%{opacity:1}100%{opacity:0}}
    @keyframes sumusSpark{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r)) translateY(-48px) scale(.2)}35%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r)) translateY(-142px) scale(1)}}
    @keyframes sumusAreaHit{0%{transform:scale(1)}35%{transform:scale(1.012)}100%{transform:scale(1)}}
    @media(max-width:520px){.sumus-practice-live .question-area{padding-left:18px;padding-right:18px}.sumus-practice-live #practice-next{position:sticky;bottom:max(12px,env(safe-area-inset-bottom));z-index:4}}
    @media(prefers-reduced-motion:reduce){.sumus-practice-live *,.sumus-result-polish *,.sumus-correct-burst *{animation:none!important;transition:none!important}.session-app.sumus-practice-live .session-header::after,.sumus-correct-burst{display:none}}
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

function celebrateCorrect(session, feedback) {
  if (feedback.dataset.sumusCelebrated || feedback.classList.contains('wrong')) return;
  feedback.dataset.sumusCelebrated = '1';
  session.classList.add('sumus-correct-hit');
  const burst = document.createElement('div');
  burst.className = 'sumus-correct-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.innerHTML = `<strong>✓ 정답!</strong>${Array.from({ length: 12 }, (_, i) => `<i style="--r:${i * 30}deg"></i>`).join('')}`;
  document.body.appendChild(burst);
  setTimeout(() => { burst.remove(); session.classList.remove('sumus-correct-hit'); }, 900);
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
    kicker.textContent = ok ? '숙련도 상승' : '오답 복습 예약';
    badge.after(kicker);
    session.querySelector('.session-header .progress')?.classList.add('sumus-progress-hit');
    if (ok) { floatGain(feedback); celebrateCorrect(session, feedback); }
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
