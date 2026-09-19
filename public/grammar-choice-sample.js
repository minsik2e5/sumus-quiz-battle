import { $, $$, esc, icon } from './modules/ui.js';

const PASSAGE = {
  title: '2026년 3월 서울교육청 · 18번',
  subtitle: 'Connexa Point Table Tennis Center',
  items: [
    { ko:'Connexa Point 탁구 센터 회원님께, 저는 Connexa Point 탁구 센터의 관리자입니다.', parts:[
      ['t','Dear Connexa Point Table Tennis Center '], ['c',['members','owners'],'members','어휘','편지의 수신자는 센터의 회원들이므로 members가 자연스러워요.'], ['t',', I am the manager of the Connexa Point Table Tennis Center.']
    ]},
    { ko:'센터의 다가오는 재개장에 관심을 가져 주셔서 감사합니다.', parts:[
      ['t','Thank you for your '], ['c',['interest','disinterest'],'interest','어휘','Thank you for your interest in ~는 “~에 관심을 가져 주셔서 감사합니다”라는 표현이에요.'], ['t',' in the upcoming '], ['c',['reopening','reopen'],'reopening','품사','upcoming 뒤에는 명사 역할을 하는 reopening이 와요.'], ['t',' of the center.']
    ]},
    { ko:'안타깝게도, 보수 과정에서 예상치 못한 전기 문제가 발견되었고, 작업이 저희가 계획했던 것보다 더 오래 걸리게 되었습니다.', parts:[
      ['c',['Unfortunately','Fortunately'],'Unfortunately','문맥','예상치 못한 문제가 발견된 부정적인 상황이므로 Unfortunately가 맞아요.'], ['t',', '], ['c',['while','during'],'during','어법','뒤에 명사구 the repair process가 오므로 전치사 during이 맞아요.'], ['t',' the repair process, '], ['c',['expected','unexpected'],'unexpected','문맥','계획에 없던 전기 문제이므로 unexpected가 맞아요.'], ['t',' electrical issues '], ['c',['were discovered','discovered'],'were discovered','수동태','전기 문제가 “발견된” 것이므로 수동태 were discovered가 맞아요.'], ['t',', '], ['c',['causing','caused'],'causing','분사','앞 문장의 결과를 이어 설명하므로 causing이 자연스러워요.'], ['t',' the work to take '], ['c',['shorter','longer'],'longer','문맥','문제로 인해 작업 시간이 계획보다 더 길어졌으므로 longer가 맞아요.'], ['t',' than we planned.']
    ]},
    { ko:'저희가 센터 재개장을 연기해야 함을 알려 드리게 되어 유감입니다.', parts:[
      ['t','We regret '], ['c',['to inform','informing'],'to inform','어법','regret to inform은 “유감스럽게도 알려 드리다”라는 정형 표현이에요.'], ['t',' you '], ['c',['who','that'],'that','접속사','뒤에 완전한 문장이 이어져 내용을 소개하므로 that이 맞아요.'], ['t',' the center’s reopening must '], ['c',['be delayed','delay'],'be delayed','수동태','재개장은 “연기되는” 것이므로 must be delayed가 맞아요.'], ['t','.']
    ]},
    { ko:'센터는 원래 4월 1일에 재개장할 예정이었습니다.', parts:[
      ['t','The center was '], ['c',['original','originally'],'originally','품사','scheduled를 꾸며 주는 부사가 필요하므로 originally가 맞아요.'], ['t',' scheduled to reopen on April 1st.']
    ]},
    { ko:'하지만, 이제는 모든 방문객의 안전을 보장하기 위해 5월 1일에 재개장할 것입니다.', parts:[
      ['t','However, '], ['c',['they','it'],'it','대명사','앞의 단수 명사 the center를 받으므로 it이 맞아요.'], ['t',' will now reopen on May 1st to '], ['c',['ensure','be ensured'],'ensure','태','센터가 안전을 “보장하는” 목적이므로 능동형 ensure가 맞아요.'], ['t',' the safety of all members.']
    ]},
    { ko:'저희는 코트에서 여러분을 곧 다시 뵐 수 있기를 기대합니다.', parts:[
      ['t','We look forward to '], ['c',['seeing','see'],'seeing','어법','look forward to에서 to는 전치사이므로 뒤에 동명사 seeing이 와요.'], ['t',' you back on the court soon.']
    ]},
    { ko:'여러분의 인내와 이해에 감사드립니다.', parts:[
      ['t','Thank you for your '], ['c',['impatience','patience'],'patience','어휘','지연에 대해 기다려 준 것에 감사하는 문맥이므로 patience가 맞아요.'], ['t',' and understanding.']
    ]}
  ]
};

function injectStyles() {
  if (document.querySelector('#gc-v2-style')) return;
  const style = document.createElement('style');
  style.id = 'gc-v2-style';
  style.textContent = `
    .gcv2{min-height:100vh;background:#f5f7fb;color:#101828;padding-bottom:104px}
    .gcv2-top{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border-bottom:1px solid #e7eaf0}
    .gcv2-topin{max-width:760px;margin:0 auto;padding:14px 20px 12px}
    .gcv2-nav{display:flex;align-items:center;gap:12px}
    .gcv2-back{width:38px;height:38px;border:1px solid #e4e7ec;background:#fff;border-radius:12px;display:grid;place-items:center;color:#344054}
    .gcv2-meta{flex:1;min-width:0}.gcv2-meta strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gcv2-meta small{display:block;color:#98a2b3;font-size:12px;margin-top:2px}
    .gcv2-count{font-size:13px;font-weight:800;color:#475467}
    .gcv2-progress{height:5px;background:#eaecf0;border-radius:999px;overflow:hidden;margin-top:12px}.gcv2-progress i{display:block;height:100%;background:#3867f0;border-radius:999px;transition:width .25s ease}
    .gcv2-main{max-width:760px;margin:0 auto;padding:28px 20px}
    .gcv2-label{display:flex;align-items:center;gap:8px;margin-bottom:14px}.gcv2-chip{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#eef4ff;color:#2e5fd0;font-size:12px;font-weight:800}.gcv2-sentence-no{font-size:12px;color:#98a2b3;font-weight:700}
    .gcv2-card{background:#fff;border:1px solid #e4e7ec;border-radius:24px;padding:28px 30px;box-shadow:0 8px 30px rgba(16,24,40,.05)}
    .gcv2-kicker{font-size:12px;font-weight:800;color:#667085;margin-bottom:10px}
    .gcv2-ko{font-size:15px;line-height:1.65;color:#667085;margin:0 0 22px}
    .gcv2-en{font-size:25px;line-height:1.65;letter-spacing:-.25px;font-weight:700;color:#101828;word-break:keep-all}
    .gcv2-fixed{color:#101828}.gcv2-done{color:#2e5fd0;background:#eef4ff;border-radius:7px;padding:1px 5px}.gcv2-current{display:inline-block;min-width:82px;text-align:center;color:#2e5fd0;background:#f5f8ff;border:2px solid #84adff;border-radius:9px;padding:0 9px;line-height:1.45}.gcv2-future{display:inline-block;min-width:68px;border-bottom:2px solid #d0d5dd;color:#d0d5dd;text-align:center}
    .gcv2-prompt{margin:26px 0 12px;font-size:14px;font-weight:800;color:#344054}
    .gcv2-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .gcv2-option{min-height:64px;border:1.5px solid #d0d5dd;border-radius:16px;background:#fff;padding:12px 16px;text-align:left;font-size:17px;font-weight:800;color:#344054;display:flex;align-items:center;gap:12px;transition:transform .1s,border-color .15s,background .15s}
    .gcv2-option:hover:not(:disabled){border-color:#84adff;background:#f8faff;transform:translateY(-1px)}.gcv2-option:active:not(:disabled){transform:scale(.99)}
    .gcv2-key{width:28px;height:28px;border-radius:8px;background:#f2f4f7;color:#667085;display:grid;place-items:center;font-size:12px;flex:none}.gcv2-option.selected{border-color:#3867f0;background:#eef4ff;color:#1849a9}.gcv2-option.correct{border-color:#32d583;background:#ecfdf3;color:#067647}.gcv2-option.wrong{border-color:#f97066;background:#fef3f2;color:#b42318}.gcv2-option.correct .gcv2-key{background:#d1fadf;color:#067647}.gcv2-option.wrong .gcv2-key{background:#fee4e2;color:#b42318}
    .gcv2-feedback{margin-top:16px;border-radius:16px;padding:15px 16px;display:flex;gap:12px;align-items:flex-start}.gcv2-feedback.ok{background:#ecfdf3;color:#05603a}.gcv2-feedback.no{background:#fff6ed;color:#9a3412}.gcv2-feedback-icon{font-size:20px;line-height:1}.gcv2-feedback b{display:block;font-size:14px;margin-bottom:4px}.gcv2-feedback p{margin:0;font-size:13px;line-height:1.55;color:inherit}
    .gcv2-helper{display:flex;justify-content:space-between;gap:12px;margin-top:14px;color:#98a2b3;font-size:12px}.gcv2-helper button{border:0;background:none;color:#667085;text-decoration:underline}
    .gcv2-bottom{position:fixed;left:0;right:0;bottom:0;z-index:11;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);border-top:1px solid #e4e7ec;padding:12px 20px calc(12px + env(safe-area-inset-bottom))}
    .gcv2-bottomin{max-width:760px;margin:0 auto;display:flex;gap:10px}.gcv2-bottom .btn{flex:1;min-height:50px}
    .gcv2-result{text-align:center;background:#fff;border:1px solid #e4e7ec;border-radius:28px;padding:34px 24px;box-shadow:0 8px 30px rgba(16,24,40,.05)}
    .gcv2-result-mark{width:66px;height:66px;margin:0 auto 16px;border-radius:20px;background:#eef4ff;color:#3867f0;display:grid;place-items:center;font-size:28px}.gcv2-result h1{font-size:28px;margin:0 0 6px}.gcv2-result p{color:#667085;margin:0}.gcv2-score{font-size:54px;font-weight:900;letter-spacing:-2px;margin:20px 0 4px}.gcv2-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.gcv2-statgrid div{background:#f8fafc;border-radius:16px;padding:14px}.gcv2-statgrid b{display:block;font-size:19px}.gcv2-statgrid span{font-size:11px;color:#98a2b3}
    @media(max-width:640px){.gcv2-main{padding:20px 14px}.gcv2-topin{padding-left:14px;padding-right:14px}.gcv2-card{padding:22px 18px;border-radius:20px}.gcv2-en{font-size:20px;line-height:1.75}.gcv2-options{grid-template-columns:1fr}.gcv2-option{min-height:58px}.gcv2-ko{font-size:14px}.gcv2-helper{display:none}}
  `;
  document.head.appendChild(style);
}

function buildSteps() {
  const steps = [];
  PASSAGE.items.forEach((item, itemIndex) => {
    item.parts.forEach((part, partIndex) => {
      if (part[0] === 'c') steps.push({ itemIndex, partIndex, options: part[1], answer: part[2], type: part[3], help: part[4] });
    });
  });
  return steps;
}

export function openGrammarChoiceSample(A, redraw) {
  injectStyles();
  A.screen = 'grammar-choice';
  const steps = buildSteps();
  const answers = new Map();
  let index = 0;
  let reveal = false;
  let result = false;

  const keyOf = step => step.itemIndex + ':' + step.partIndex;
  const current = () => steps[index];

  function renderSentence(step) {
    const item = PASSAGE.items[step.itemIndex];
    return item.parts.map((part, partIndex) => {
      if (part[0] === 't') return '<span class="gcv2-fixed">' + esc(part[1]) + '</span>';
      const key = step.itemIndex + ':' + partIndex;
      const chosen = answers.get(key);
      if (partIndex === step.partIndex) return '<span class="gcv2-current">' + esc(chosen || '_____') + '</span>';
      if (chosen) return '<span class="gcv2-done">' + esc(chosen) + '</span>';
      return '<span class="gcv2-future">_____</span>';
    }).join('');
  }

  function exit() {
    A.screen = null;
    redraw();
    window.scrollTo(0, 0);
  }

  function mountResult() {
    const correct = steps.filter(step => answers.get(keyOf(step)) === step.answer).length;
    const wrong = steps.length - correct;
    const rate = Math.round(correct / steps.length * 100);
    $('#app').innerHTML = `<div class="gcv2">
      <header class="gcv2-top"><div class="gcv2-topin"><div class="gcv2-nav"><button class="gcv2-back" id="gcv2-back">${icon('back')}</button><div class="gcv2-meta"><strong>${esc(PASSAGE.title)}</strong><small>어법·어휘 고르기 · 결과</small></div></div></div></header>
      <main class="gcv2-main"><section class="gcv2-result"><div class="gcv2-result-mark">${rate===100?'✓':'★'}</div><h1>${rate===100?'18번 MASTER!':'한 번 더 다듬어 볼까요?'}</h1><p>문장 전체를 읽으며 선택한 결과예요.</p><div class="gcv2-score">${rate}<small style="font-size:22px">%</small></div><div class="gcv2-statgrid"><div><b>${correct}</b><span>정답</span></div><div><b>${wrong}</b><span>오답</span></div><div><b>${steps.length}</b><span>전체</span></div></div></section></main>
      <div class="gcv2-bottom"><div class="gcv2-bottomin"><button class="btn" id="gcv2-retry">처음부터 다시</button><button class="btn primary" id="gcv2-home">홈으로</button></div></div>
    </div>`;
    $('#gcv2-back').onclick = cleanupExit;
    $('#gcv2-home').onclick = cleanupExit;
    $('#gcv2-retry').onclick = () => { answers.clear(); index = 0; reveal = false; result = false; mount(); };
  }

  function mount() {
    if (result) return mountResult();
    const step = current();
    const item = PASSAGE.items[step.itemIndex];
    const chosen = answers.get(keyOf(step));
    const isCorrect = chosen === step.answer;
    const progress = Math.round((index / steps.length) * 100);

    const options = step.options.map((option, optionIndex) => {
      let cls = 'gcv2-option';
      if (chosen === option) cls += ' selected';
      if (reveal && option === step.answer) cls += ' correct';
      else if (reveal && chosen === option && option !== step.answer) cls += ' wrong';
      return `<button class="${cls}" data-answer="${esc(option)}" ${reveal?'disabled':''}><span class="gcv2-key">${optionIndex+1}</span><span>${esc(option)}</span></button>`;
    }).join('');

    $('#app').innerHTML = `<div class="gcv2">
      <header class="gcv2-top"><div class="gcv2-topin">
        <div class="gcv2-nav"><button class="gcv2-back" id="gcv2-back">${icon('back')}</button><div class="gcv2-meta"><strong>${esc(PASSAGE.title)}</strong><small>${esc(PASSAGE.subtitle)}</small></div><div class="gcv2-count">${index+1} / ${steps.length}</div></div>
        <div class="gcv2-progress"><i style="width:${progress}%"></i></div>
      </div></header>
      <main class="gcv2-main">
        <div class="gcv2-label"><span class="gcv2-chip">${esc(step.type)}</span><span class="gcv2-sentence-no">문장 ${String(step.itemIndex+1).padStart(2,'0')}</span></div>
        <section class="gcv2-card">
          <div class="gcv2-kicker">문장 전체를 읽고 빈칸에 알맞은 표현을 고르세요.</div>
          <p class="gcv2-ko">${esc(item.ko)}</p>
          <div class="gcv2-en">${renderSentence(step)}</div>
          <div class="gcv2-prompt">어떤 표현이 알맞을까요?</div>
          <div class="gcv2-options">${options}</div>
          ${reveal ? `<div class="gcv2-feedback ${isCorrect?'ok':'no'}"><div class="gcv2-feedback-icon">${isCorrect?'✓':'!'}</div><div><b>${isCorrect?'정답이에요':'정답은 '+esc(step.answer)+'예요'}</b><p>${esc(step.help)}</p></div></div>` : ''}
          <div class="gcv2-helper"><span>키보드 1 · 2로도 선택할 수 있어요.</span><span>한 번에 한 선택지만 집중해서 풀어요.</span></div>
        </section>
      </main>
      <div class="gcv2-bottom"><div class="gcv2-bottomin">${reveal?'<button class="btn primary" id="gcv2-next">'+(index===steps.length-1?'결과 보기':'다음 문제')+' '+icon('arrow')+'</button>':'<button class="btn" disabled>답을 선택하면 바로 채점돼요</button>'}</div></div>
    </div>`;

    $('#gcv2-back').onclick = cleanupExit;
    $$('[data-answer]').forEach(button => button.onclick = () => {
      answers.set(keyOf(step), button.dataset.answer);
      reveal = true;
      mount();
    });
    $('#gcv2-next')?.addEventListener('click', () => {
      if (index >= steps.length - 1) result = true;
      else { index++; reveal = false; }
      mount();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const keyboard = event => {
    if (A.screen !== 'grammar-choice' || result || reveal) return;
    if (event.key === '1' || event.key === '2') document.querySelectorAll('[data-answer]')[Number(event.key)-1]?.click();
  };
  document.addEventListener('keydown', keyboard, { once: false });

  function cleanupExit() {
    document.removeEventListener('keydown', keyboard);
    exit();
  }

  mount();
}
