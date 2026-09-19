import { $, $$, esc, icon, toast } from './modules/ui.js';

const PASSAGE = {
  id: '2026-03-seoul-18',
  title: '2026년 3월 서울교육청 · 18번',
  subtitle: 'Connexa Point Table Tennis Center',
  source: 'WORKBOOK 6 · 어법·어휘 고르기',
  sentences: [
    {
      ko: 'Connexa Point 탁구 센터 회원님께, 저는 Connexa Point 탁구 센터의 관리자입니다.',
      parts: [
        ['t', 'Dear Connexa Point Table Tennis Center '],
        ['c', ['members', 'owners'], 'members', '어휘', '편지의 수신자는 센터의 회원들이므로 members가 자연스러워요.'],
        ['t', ', I am the manager of the Connexa Point Table Tennis Center.']
      ]
    },
    {
      ko: '센터의 다가오는 재개장에 관심을 가져 주셔서 감사합니다.',
      parts: [
        ['t', 'Thank you for your '],
        ['c', ['interest', 'disinterest'], 'interest', '어휘', 'Thank you for your interest in ~는 “~에 관심을 가져 주셔서 감사합니다”라는 표현이에요.'],
        ['t', ' in the upcoming '],
        ['c', ['reopening', 'reopen'], 'reopening', '품사', 'upcoming 뒤에는 명사 역할을 하는 reopening이 와요.'],
        ['t', ' of the center.']
      ]
    },
    {
      ko: '안타깝게도, 보수 과정에서 예상치 못한 전기 문제가 발견되었고, 작업이 저희가 계획했던 것보다 더 오래 걸리게 되었습니다.',
      parts: [
        ['c', ['Unfortunately', 'Fortunately'], 'Unfortunately', '문맥', '예상치 못한 문제가 발견된 부정적인 상황이므로 Unfortunately가 맞아요.'],
        ['t', ', '],
        ['c', ['while', 'during'], 'during', '어법', '뒤에 명사구 the repair process가 오므로 전치사 during이 맞아요.'],
        ['t', ' the repair process, '],
        ['c', ['expected', 'unexpected'], 'unexpected', '문맥', '계획에 없던 전기 문제이므로 unexpected가 맞아요.'],
        ['t', ' electrical issues '],
        ['c', ['were discovered', 'discovered'], 'were discovered', '수동태', '전기 문제가 “발견된” 것이므로 수동태 were discovered가 맞아요.'],
        ['t', ', '],
        ['c', ['causing', 'caused'], 'causing', '분사', '앞 문장의 결과를 이어 설명하므로 causing이 자연스러워요.'],
        ['t', ' the work to take '],
        ['c', ['shorter', 'longer'], 'longer', '문맥', '문제로 인해 작업 시간이 계획보다 더 길어졌으므로 longer가 맞아요.'],
        ['t', ' than we planned.']
      ]
    },
    {
      ko: '저희가 센터 재개장을 연기해야 함을 알려 드리게 되어 유감입니다.',
      parts: [
        ['t', 'We regret '],
        ['c', ['to inform', 'informing'], 'to inform', '어법', 'regret to inform은 “유감스럽게도 알려 드리다”라는 정형 표현이에요.'],
        ['t', ' you '],
        ['c', ['who', 'that'], 'that', '접속사', '뒤에 완전한 문장이 이어져 내용을 소개하므로 that이 맞아요.'],
        ['t', ' the center’s reopening must '],
        ['c', ['be delayed', 'delay'], 'be delayed', '수동태', '재개장은 “연기되는” 것이므로 must be delayed가 맞아요.'],
        ['t', '.']
      ]
    },
    {
      ko: '센터는 원래 4월 1일에 재개장할 예정이었습니다.',
      parts: [
        ['t', 'The center was '],
        ['c', ['original', 'originally'], 'originally', '품사', 'scheduled를 꾸며 주는 부사가 필요하므로 originally가 맞아요.'],
        ['t', ' scheduled to reopen on April 1st.']
      ]
    },
    {
      ko: '하지만, 이제는 모든 방문객의 안전을 보장하기 위해 5월 1일에 재개장할 것입니다.',
      parts: [
        ['t', 'However, '],
        ['c', ['they', 'it'], 'it', '대명사', '앞의 단수 명사 the center를 받으므로 it이 맞아요.'],
        ['t', ' will now reopen on May 1st to '],
        ['c', ['ensure', 'be ensured'], 'ensure', '태', '센터가 안전을 “보장하는” 목적이므로 능동형 ensure가 맞아요.'],
        ['t', ' the safety of all members.']
      ]
    },
    {
      ko: '저희는 코트에서 여러분을 곧 다시 뵐 수 있기를 기대합니다.',
      parts: [
        ['t', 'We look forward to '],
        ['c', ['seeing', 'see'], 'seeing', '어법', 'look forward to에서 to는 전치사이므로 뒤에 동명사 seeing이 와요.'],
        ['t', ' you back on the court soon.']
      ]
    },
    {
      ko: '여러분의 인내와 이해에 감사드립니다.',
      parts: [
        ['t', 'Thank you for your '],
        ['c', ['impatience', 'patience'], 'patience', '어휘', '지연을 이해하고 기다려 준 것에 감사하는 문맥이므로 patience가 맞아요.'],
        ['t', ' and understanding.']
      ]
    }
  ]
};

function addStyles() {
  if (document.querySelector('#gc-v3-style')) return;
  const style = document.createElement('style');
  style.id = 'gc-v3-style';
  style.textContent = `
    .gcv3{min-height:100vh;background:#f6f7fb;color:#101828;padding-bottom:112px}
    .gcv3-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.95);backdrop-filter:blur(18px);border-bottom:1px solid #e9ecf2}
    .gcv3-topin{max-width:820px;margin:0 auto;padding:13px 20px 12px}
    .gcv3-nav{display:flex;align-items:center;gap:12px}
    .gcv3-back{width:40px;height:40px;border:1px solid #e4e7ec;background:#fff;border-radius:13px;display:grid;place-items:center;color:#344054;box-shadow:0 1px 2px rgba(16,24,40,.04)}
    .gcv3-meta{min-width:0;flex:1}.gcv3-meta strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gcv3-meta small{display:block;color:#98a2b3;font-size:12px;margin-top:2px}
    .gcv3-count{font-size:13px;font-weight:850;color:#475467;white-space:nowrap}
    .gcv3-progress{height:6px;background:#edf0f5;border-radius:999px;overflow:hidden;margin-top:12px}.gcv3-progress i{display:block;height:100%;background:#3867f0;border-radius:999px;transition:width .25s ease}
    .gcv3-main{max-width:820px;margin:0 auto;padding:26px 20px}
    .gcv3-stagebar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
    .gcv3-stage{display:flex;align-items:center;gap:8px}.gcv3-chip{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#eef4ff;color:#2e5fd0;font-size:12px;font-weight:850}.gcv3-stage small{color:#98a2b3;font-size:12px}
    .gcv3-translate{border:0;background:none;color:#667085;font-size:12px;font-weight:750;padding:6px 0}
    .gcv3-card{background:#fff;border:1px solid #e4e7ec;border-radius:26px;padding:28px 30px;box-shadow:0 12px 34px rgba(16,24,40,.055)}
    .gcv3-sentence-label{display:flex;align-items:center;gap:8px;margin-bottom:18px}.gcv3-sentence-label b{font-size:12px;color:#3867f0;letter-spacing:.04em}.gcv3-sentence-label span{font-size:12px;color:#98a2b3}
    .gcv3-ko{font-size:14px;line-height:1.65;color:#667085;background:#f8fafc;border-radius:14px;padding:12px 14px;margin:0 0 18px}
    .gcv3-en{font-size:24px;line-height:1.72;letter-spacing:-.22px;font-weight:720;color:#101828;word-break:keep-all}
    .gcv3-inline{display:inline-flex;align-items:center;justify-content:center;min-width:58px;height:34px;padding:0 10px;margin:0 2px;border-radius:9px;background:#f2f4f7;color:#98a2b3;font-size:.78em;font-weight:850;vertical-align:.06em}
    .gcv3-inline.filled{background:#eef4ff;color:#1849a9}.gcv3-inline.correct{background:#ecfdf3;color:#067647}.gcv3-inline.wrong{background:#fef3f2;color:#b42318}
    .gcv3-divider{height:1px;background:#edf0f5;margin:26px 0 20px}
    .gcv3-question-title{font-size:13px;font-weight:850;color:#344054;margin-bottom:12px}
    .gcv3-groups{display:grid;gap:10px}
    .gcv3-group{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:stretch}
    .gcv3-number{width:34px;height:100%;min-height:52px;border-radius:12px;background:#f2f4f7;color:#667085;display:grid;place-items:center;font-size:12px;font-weight:900}
    .gcv3-segment{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .gcv3-option{min-height:52px;border:1.5px solid #d0d5dd;border-radius:14px;background:#fff;padding:10px 14px;font-size:16px;font-weight:800;color:#344054;text-align:center;transition:.14s ease}
    .gcv3-option:hover:not(:disabled){border-color:#84adff;background:#f8faff;transform:translateY(-1px)}
    .gcv3-option.selected{border-color:#3867f0;background:#eef4ff;color:#1849a9;box-shadow:0 0 0 2px rgba(56,103,240,.07)}
    .gcv3-option.correct{border-color:#32d583;background:#ecfdf3;color:#067647}.gcv3-option.wrong{border-color:#f97066;background:#fef3f2;color:#b42318}
    .gcv3-feedbacks{display:grid;gap:9px;margin-top:18px}
    .gcv3-feedback{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:14px;background:#fff6ed;color:#9a3412}.gcv3-feedback.ok{background:#ecfdf3;color:#05603a}
    .gcv3-feedback i{width:23px;height:23px;border-radius:999px;background:rgba(255,255,255,.65);display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900;flex:none}.gcv3-feedback b{display:block;font-size:13px;margin-bottom:3px}.gcv3-feedback p{margin:0;font-size:12.5px;line-height:1.5;color:inherit}
    .gcv3-tip{display:flex;justify-content:space-between;gap:12px;margin-top:13px;color:#98a2b3;font-size:11.5px}
    .gcv3-bottom{position:fixed;left:0;right:0;bottom:0;z-index:25;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);border-top:1px solid #e4e7ec;padding:12px 20px calc(12px + env(safe-area-inset-bottom))}
    .gcv3-bottomin{max-width:820px;margin:0 auto;display:flex;gap:10px}.gcv3-bottom .btn{flex:1;min-height:52px;border-radius:14px}
    .gcv3-recall-banner{display:flex;align-items:center;gap:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:14px 16px;margin-bottom:14px}.gcv3-recall-banner strong{display:block;font-size:13px;color:#9a3412}.gcv3-recall-banner span{display:block;font-size:12px;color:#c2410c;margin-top:2px}
    .gcv3-result{background:#fff;border:1px solid #e4e7ec;border-radius:28px;padding:34px 26px;text-align:center;box-shadow:0 12px 34px rgba(16,24,40,.055)}
    .gcv3-resultmark{width:70px;height:70px;border-radius:22px;background:#eef4ff;color:#3867f0;display:grid;place-items:center;margin:0 auto 16px;font-size:28px}.gcv3-result h1{font-size:28px;margin:0 0 6px}.gcv3-result>p{margin:0;color:#667085}
    .gcv3-score{font-size:58px;font-weight:920;letter-spacing:-2px;margin:22px 0 4px}.gcv3-score small{font-size:20px;color:#667085}
    .gcv3-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.gcv3-statgrid div{background:#f8fafc;border-radius:16px;padding:14px}.gcv3-statgrid b{display:block;font-size:19px}.gcv3-statgrid span{font-size:11px;color:#98a2b3}
    .gcv3-mastery{margin-top:16px;padding:14px;border-radius:16px;background:#ecfdf3;color:#067647;font-size:13px;font-weight:800}
    @media(max-width:680px){
      .gcv3-main{padding:18px 14px}.gcv3-topin{padding-left:14px;padding-right:14px}.gcv3-card{padding:21px 17px;border-radius:20px}.gcv3-en{font-size:20px;line-height:1.78}.gcv3-group{grid-template-columns:30px 1fr;gap:8px}.gcv3-number{width:30px}.gcv3-option{font-size:15px;padding:10px 8px}.gcv3-tip{display:none}.gcv3-stagebar{align-items:flex-start}.gcv3-ko{font-size:13px}
    }
  `;
  document.head.appendChild(style);
}

function sentenceChoices(sentence) {
  return sentence.parts.map((part, partIndex) => ({ part, partIndex })).filter(item => item.part[0] === 'c');
}

function allChoiceRefs() {
  const refs = [];
  PASSAGE.sentences.forEach((sentence, sentenceIndex) => {
    sentenceChoices(sentence).forEach(({ part, partIndex }) => refs.push({
      sentenceIndex,
      partIndex,
      options: part[1],
      answer: part[2],
      type: part[3],
      help: part[4]
    }));
  });
  return refs;
}

export function openGrammarChoiceSample(A, redraw) {
  addStyles();
  A.screen = 'grammar-choice';

  const answers = new Map();
  const firstRoundWrong = [];
  const firstRoundCorrect = new Set();
  let sentenceIndex = 0;
  let sentenceGraded = false;
  let showKo = false;
  let stage = 'practice';
  let recallQueue = [];
  let recallIndex = 0;
  let recallAnswered = false;
  let recallPick = null;

  const choiceKey = (s, p) => s + ':' + p;
  const currentSentence = () => PASSAGE.sentences[sentenceIndex];

  function cleanupExit() {
    document.removeEventListener('keydown', keyboard);
    A.screen = null;
    redraw();
    window.scrollTo(0, 0);
  }

  function renderEnglish(sentence, onlyPartIndex = null, recallMode = false) {
    return sentence.parts.map((part, partIndex) => {
      if (part[0] === 't') return esc(part[1]);
      const key = choiceKey(sentenceIndex, partIndex);
      let value = answers.get(key);

      if (recallMode) {
        const target = onlyPartIndex === partIndex;
        if (target) value = recallPick;
        else value = part[2];
      }

      let cls = 'gcv3-inline';
      if (value) cls += ' filled';
      if (sentenceGraded && !recallMode) cls += value === part[2] ? ' correct' : ' wrong';
      if (recallMode && recallAnswered && onlyPartIndex === partIndex) cls += value === part[2] ? ' correct' : ' wrong';
      return '<span class="' + cls + '">' + esc(value || '____') + '</span>';
    }).join('');
  }

  function gradeSentence() {
    const sentence = currentSentence();
    const choices = sentenceChoices(sentence);
    const missing = choices.filter(({ partIndex }) => !answers.has(choiceKey(sentenceIndex, partIndex))).length;
    if (missing) return toast('아직 ' + missing + '개 선택이 남았어요.');

    sentenceGraded = true;
    for (const { part, partIndex } of choices) {
      const ref = { sentenceIndex, partIndex, options: part[1], answer: part[2], type: part[3], help: part[4] };
      const key = choiceKey(sentenceIndex, partIndex);
      if (answers.get(key) === part[2]) firstRoundCorrect.add(key);
      else if (!firstRoundWrong.some(x => x.sentenceIndex === sentenceIndex && x.partIndex === partIndex)) firstRoundWrong.push(ref);
    }
    mountPractice();
  }

  function nextSentence() {
    if (sentenceIndex >= PASSAGE.sentences.length - 1) {
      if (firstRoundWrong.length) {
        stage = 'recall';
        recallQueue = firstRoundWrong.map(item => ({ ...item, attempts: 0 }));
        recallIndex = 0;
        recallAnswered = false;
        recallPick = null;
        mountRecall();
      } else {
        stage = 'result';
        mountResult();
      }
      return;
    }
    sentenceIndex++;
    sentenceGraded = false;
    showKo = false;
    mountPractice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mountShell(meta, progress, body, bottom) {
    $('#app').innerHTML = `<div class="gcv3">
      <header class="gcv3-top"><div class="gcv3-topin">
        <div class="gcv3-nav"><button class="gcv3-back" id="gcv3-back">${icon('back')}</button><div class="gcv3-meta"><strong>${esc(PASSAGE.title)}</strong><small>${esc(meta)}</small></div><div class="gcv3-count">${esc(progress.label)}</div></div>
        <div class="gcv3-progress"><i style="width:${Math.max(0, Math.min(100, progress.percent))}%"></i></div>
      </div></header>
      <main class="gcv3-main">${body}</main>
      <div class="gcv3-bottom"><div class="gcv3-bottomin">${bottom}</div></div>
    </div>`;
    $('#gcv3-back').onclick = cleanupExit;
  }

  function mountPractice() {
    const sentence = currentSentence();
    const choices = sentenceChoices(sentence);
    const chosenCount = choices.filter(({ partIndex }) => answers.has(choiceKey(sentenceIndex, partIndex))).length;
    const progress = Math.round((sentenceIndex / PASSAGE.sentences.length) * 100);

    const groups = choices.map(({ part, partIndex }, groupIndex) => {
      const key = choiceKey(sentenceIndex, partIndex);
      const chosen = answers.get(key);
      const buttons = part[1].map(option => {
        let cls = 'gcv3-option' + (chosen === option ? ' selected' : '');
        if (sentenceGraded) {
          if (option === part[2]) cls += ' correct';
          else if (chosen === option) cls += ' wrong';
        }
        return `<button class="${cls}" data-choice-key="${key}" data-choice-value="${esc(option)}" ${sentenceGraded ? 'disabled' : ''}>${esc(option)}</button>`;
      }).join('');
      return `<div class="gcv3-group"><div class="gcv3-number">${groupIndex + 1}</div><div class="gcv3-segment">${buttons}</div></div>`;
    }).join('');

    const feedbacks = sentenceGraded ? choices.map(({ part, partIndex }, groupIndex) => {
      const chosen = answers.get(choiceKey(sentenceIndex, partIndex));
      const ok = chosen === part[2];
      return `<div class="gcv3-feedback ${ok ? 'ok' : ''}"><i>${ok ? '✓' : '!'}</i><div><b>${groupIndex + 1}. ${ok ? '정답' : '정답은 ' + esc(part[2])}</b><p>${esc(part[4])}</p></div></div>`;
    }).join('') : '';

    const body = `
      <div class="gcv3-stagebar"><div class="gcv3-stage"><span class="gcv3-chip">1차 · 문장 학습</span><small>문장 ${sentenceIndex + 1} / ${PASSAGE.sentences.length}</small></div><button class="gcv3-translate" id="gcv3-translate">${showKo ? '해석 숨기기' : '해석 보기'}</button></div>
      <section class="gcv3-card">
        <div class="gcv3-sentence-label"><b>SENTENCE ${String(sentenceIndex + 1).padStart(2, '0')}</b><span>선택 ${chosenCount} / ${choices.length}</span></div>
        ${showKo ? `<p class="gcv3-ko">${esc(sentence.ko)}</p>` : ''}
        <div class="gcv3-en">${renderEnglish(sentence)}</div>
        <div class="gcv3-divider"></div>
        <div class="gcv3-question-title">괄호마다 알맞은 표현을 하나씩 선택하세요.</div>
        <div class="gcv3-groups">${groups}</div>
        ${sentenceGraded ? `<div class="gcv3-feedbacks">${feedbacks}</div>` : ''}
        <div class="gcv3-tip"><span>한 문장 안에서 모든 괄호를 해결해요.</span><span>1·2 키로 현재 선택지를 바꿀 수 있어요.</span></div>
      </section>`;

    const allChosen = chosenCount === choices.length;
    const bottom = sentenceGraded
      ? `<button class="btn primary" id="gcv3-next">${sentenceIndex === PASSAGE.sentences.length - 1 ? (firstRoundWrong.length ? '오답 복습 시작' : '결과 보기') : '다음 문장'} ${icon('arrow')}</button>`
      : `<button class="btn primary" id="gcv3-grade" ${allChosen ? '' : 'disabled'}>문장 채점</button>`;

    mountShell(PASSAGE.source, { label: (sentenceIndex + 1) + ' / ' + PASSAGE.sentences.length, percent: progress }, body, bottom);

    $('#gcv3-translate').onclick = () => { showKo = !showKo; mountPractice(); };
    $$('[data-choice-key]').forEach(button => button.onclick = () => {
      answers.set(button.dataset.choiceKey, button.dataset.choiceValue);
      mountPractice();
    });
    $('#gcv3-grade')?.addEventListener('click', gradeSentence);
    $('#gcv3-next')?.addEventListener('click', nextSentence);
  }

  function mountRecall() {
    if (!recallQueue.length || recallIndex >= recallQueue.length) {
      stage = 'result';
      return mountResult();
    }

    const item = recallQueue[recallIndex];
    const sentence = PASSAGE.sentences[item.sentenceIndex];
    sentenceIndex = item.sentenceIndex;
    const progress = Math.round((recallIndex / recallQueue.length) * 100);

    const options = item.options.map(option => {
      let cls = 'gcv3-option' + (recallPick === option ? ' selected' : '');
      if (recallAnswered) {
        if (option === item.answer) cls += ' correct';
        else if (recallPick === option) cls += ' wrong';
      }
      return `<button class="${cls}" data-recall-value="${esc(option)}" ${recallAnswered ? 'disabled' : ''}>${esc(option)}</button>`;
    }).join('');

    const body = `
      <div class="gcv3-recall-banner"><div>↻</div><div><strong>2차 · 오답 리콜</strong><span>1차에서 틀린 선택지만 다시 확인해요.</span></div></div>
      <div class="gcv3-stagebar"><div class="gcv3-stage"><span class="gcv3-chip">${esc(item.type)}</span><small>오답 ${recallIndex + 1} / ${recallQueue.length}</small></div><span></span></div>
      <section class="gcv3-card">
        <div class="gcv3-sentence-label"><b>RECALL</b><span>해석 없이 다시 도전</span></div>
        <div class="gcv3-en">${renderEnglish(sentence, item.partIndex, true)}</div>
        <div class="gcv3-divider"></div>
        <div class="gcv3-question-title">이번에는 힌트 없이 다시 골라보세요.</div>
        <div class="gcv3-segment">${options}</div>
        ${recallAnswered ? `<div class="gcv3-feedbacks"><div class="gcv3-feedback ${recallPick === item.answer ? 'ok' : ''}"><i>${recallPick === item.answer ? '✓' : '!'}</i><div><b>${recallPick === item.answer ? '이번에는 맞았어요' : '한 번 더 기억해둘 포인트'}</b><p>${esc(item.help)}</p></div></div></div>` : ''}
      </section>`;

    const bottom = recallAnswered
      ? `<button class="btn primary" id="gcv3-recall-next">${recallIndex === recallQueue.length - 1 ? '결과 보기' : '다음 오답'} ${icon('arrow')}</button>`
      : '<button class="btn" disabled>답을 선택하면 바로 확인돼요</button>';

    mountShell('오답 리콜 · 틀린 것만 다시', { label: (recallIndex + 1) + ' / ' + recallQueue.length, percent: progress }, body, bottom);

    $$('[data-recall-value]').forEach(button => button.onclick = () => {
      recallPick = button.dataset.recallValue;
      recallAnswered = true;
      item.attempts++;
      if (recallPick !== item.answer) {
        const copy = { ...item, attempts: item.attempts };
        recallQueue.push(copy);
      }
      mountRecall();
    });

    $('#gcv3-recall-next')?.addEventListener('click', () => {
      recallIndex++;
      recallAnswered = false;
      recallPick = null;
      if (recallIndex >= recallQueue.length) stage = 'result';
      stage === 'result' ? mountResult() : mountRecall();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function mountResult() {
    const total = allChoiceRefs().length;
    const firstCorrect = total - firstRoundWrong.length;
    const firstRate = Math.round((firstCorrect / total) * 100);
    const recallAttempts = recallQueue.reduce((n, item) => n + (item.attempts || 0), 0);
    const mastered = firstRoundWrong.length === 0 || recallQueue.every(item => item.attempts > 0);
    const body = `
      <section class="gcv3-result">
        <div class="gcv3-resultmark">${mastered ? '✓' : '★'}</div>
        <h1>${mastered ? '18번 MASTER!' : '한 번 더 다듬어 볼까요?'}</h1>
        <p>문장 단위 학습과 오답 리콜을 마쳤어요.</p>
        <div class="gcv3-score">${firstRate}<small>% · 1차</small></div>
        <div class="gcv3-statgrid"><div><b>${firstCorrect}</b><span>1차 정답</span></div><div><b>${firstRoundWrong.length}</b><span>1차 오답</span></div><div><b>${recallAttempts}</b><span>오답 리콜</span></div></div>
        ${mastered ? '<div class="gcv3-mastery">✓ 틀린 선택지까지 다시 확인했어요. 이 지문은 MASTER 처리할 수 있어요.</div>' : ''}
      </section>`;
    const bottom = '<button class="btn" id="gcv3-restart">처음부터 다시</button><button class="btn primary" id="gcv3-home">홈으로</button>';
    mountShell('학습 완료', { label: '완료', percent: 100 }, body, bottom);
    $('#gcv3-home').onclick = cleanupExit;
    $('#gcv3-restart').onclick = () => {
      answers.clear();
      firstRoundWrong.length = 0;
      firstRoundCorrect.clear();
      sentenceIndex = 0;
      sentenceGraded = false;
      showKo = false;
      stage = 'practice';
      recallQueue = [];
      recallIndex = 0;
      recallAnswered = false;
      recallPick = null;
      mountPractice();
      window.scrollTo(0, 0);
    };
  }

  function keyboard(event) {
    if (A.screen !== 'grammar-choice') return;
    if (stage === 'practice' && !sentenceGraded && (event.key === '1' || event.key === '2')) {
      const sentence = currentSentence();
      const nextUnanswered = sentenceChoices(sentence).find(({ partIndex }) => !answers.has(choiceKey(sentenceIndex, partIndex)));
      if (!nextUnanswered) return;
      const value = nextUnanswered.part[1][Number(event.key) - 1];
      if (value !== undefined) {
        answers.set(choiceKey(sentenceIndex, nextUnanswered.partIndex), value);
        mountPractice();
      }
    }
    if (stage === 'recall' && !recallAnswered && (event.key === '1' || event.key === '2')) {
      const button = $$('[data-recall-value]')[Number(event.key) - 1];
      button?.click();
    }
  }

  document.addEventListener('keydown', keyboard);
  mountPractice();
}
