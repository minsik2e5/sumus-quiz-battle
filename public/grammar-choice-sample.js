import { $, $$, esc, icon, toast } from './modules/ui.js';
import { DANWONGO_PASSAGES, getDanwongoPassage } from './danwongo-grammar-data.js?v=1';

let PASSAGE = DANWONGO_PASSAGES[0];

function addStyles() {
  if (document.querySelector('#gc-v4-style')) return;
  document.querySelector('#gc-v3-style')?.remove();
  const style = document.createElement('style');
  style.id = 'gc-v4-style';
  style.textContent = `
    .gcv3{
      min-height:100svh;background:#f7f9fd;color:#101828;padding-bottom:118px;
      -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility
    }
    .gcv3 button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .gcv3-top{
      position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);
      backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
      border-bottom:1px solid #e8ecf3
    }
    .gcv3-topin{max-width:760px;margin:0 auto;padding:14px 18px 12px}
    .gcv3-nav{display:flex;align-items:center;gap:12px}
    .gcv3-back{
      width:42px;height:42px;flex:none;border:1px solid #e1e6ef;background:#fff;border-radius:14px;
      display:grid;place-items:center;color:#344054;box-shadow:0 2px 6px rgba(16,24,40,.05)
    }
    .gcv3-back .icon{width:20px;height:20px}
    .gcv3-meta{min-width:0;flex:1}
    .gcv3-meta strong{
      display:block;font-size:16px;line-height:1.25;font-weight:850;letter-spacing:-.25px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#172033
    }
    .gcv3-meta small{display:block;color:#8d99ad;font-size:12px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gcv3-count{font-size:14px;font-weight:850;color:#344054;white-space:nowrap}
    .gcv3-progress{height:5px;background:#e9edf4;border-radius:999px;overflow:hidden;margin-top:13px}
    .gcv3-progress i{display:block;height:100%;background:#3f6df3;border-radius:999px;transition:width .25s ease}

    .gcv3-main{max-width:760px;margin:0 auto;padding:24px 18px 26px}
    .gcv3-stagebar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 14px}
    .gcv3-stage{display:flex;align-items:center;gap:9px;min-width:0}
    .gcv3-chip{
      display:inline-flex;align-items:center;height:34px;padding:0 13px;border-radius:12px;
      background:#edf3ff;color:#2457c6;font-size:13px;font-weight:850;white-space:nowrap
    }
    .gcv3-stage small{color:#8b96a8;font-size:13px;font-weight:700;white-space:nowrap}
    .gcv3-translate{
      min-height:36px;border:0;background:transparent;color:#506176;font-size:13px;font-weight:800;
      padding:7px 4px;white-space:nowrap
    }

    .gcv3-card{
      background:#fff;border:1px solid #e3e8f0;border-radius:24px;padding:25px 25px 24px;
      box-shadow:0 10px 28px rgba(32,48,78,.055)
    }
    .gcv3-sentence-label{
      display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:19px
    }
    .gcv3-sentence-label b{font-size:12px;color:#3867f0;letter-spacing:.055em;font-weight:900}
    .gcv3-sentence-label span{font-size:12px;color:#8d99ad;font-weight:700}
    .gcv3-ko{
      font-size:13.5px;line-height:1.62;color:#667085;background:#f7f9fc;border:1px solid #eef1f5;
      border-radius:13px;padding:11px 13px;margin:0 0 17px
    }
    .gcv3-en{
      font-size:clamp(21px,3.2vw,25px);line-height:1.64;letter-spacing:-.35px;font-weight:760;
      color:#121a2c;word-break:keep-all;overflow-wrap:normal
    }
    .gcv3-en.medium{font-size:clamp(20px,2.9vw,23px);line-height:1.62}
    .gcv3-en.long{font-size:clamp(18.5px,2.6vw,21.5px);line-height:1.6}
    .gcv3-inline{
      display:inline-flex;align-items:center;justify-content:center;min-width:54px;min-height:36px;
      padding:2px 10px;margin:2px 2px;border-radius:10px;background:#f0f3f8;color:#8e99aa;
      font-size:.8em;font-weight:850;vertical-align:.03em;line-height:1.25
    }
    .gcv3-inline.filled{background:#edf3ff;color:#2457c6}
    .gcv3-inline.correct{background:#e7f8ef;color:#027a48;box-shadow:inset 0 0 0 1px #6ce9a6}
    .gcv3-inline.wrong{background:#fff0ef;color:#b42318;box-shadow:inset 0 0 0 1px #fda29b}
    .gcv3-divider{height:1px;background:#edf0f4;margin:24px 0 18px}
    .gcv3-question-title{font-size:14px;font-weight:850;color:#344054;margin-bottom:13px}

    .gcv3-groups{display:grid;gap:10px}
    .gcv3-group{display:grid;grid-template-columns:38px minmax(0,1fr);gap:9px;align-items:stretch}
    .gcv3-number{
      width:38px;min-height:56px;border-radius:13px;background:#f3f5f8;color:#697586;
      display:grid;place-items:center;font-size:13px;font-weight:900
    }
    .gcv3-segment{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px}
    .gcv3-option{
      min-width:0;min-height:56px;border:1.5px solid #cfd6e2;border-radius:14px;background:#fff;
      padding:10px 10px;font-size:16px;line-height:1.2;font-weight:820;color:#344054;text-align:center;
      transition:border-color .14s ease,background .14s ease,box-shadow .14s ease,transform .1s ease
    }
    .gcv3-option:hover:not(:disabled){border-color:#8eabff;background:#f8faff}
    .gcv3-option:active:not(:disabled){transform:scale(.985)}
    .gcv3-option.selected{
      border-color:#3f6df3;background:#edf3ff;color:#2457c6;
      box-shadow:0 0 0 2px rgba(63,109,243,.09)
    }
    .gcv3-option.correct{border-color:#12b76a;background:#ecfdf3;color:#027a48;box-shadow:0 0 0 1px rgba(18,183,106,.08)}
    .gcv3-option.wrong{border-color:#f04438;background:#fff1f0;color:#b42318;box-shadow:0 0 0 1px rgba(240,68,56,.06)}

    .gcv3-feedbacks{display:grid;gap:9px;margin-top:17px}
    .gcv3-feedback{
      display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:14px;
      background:#fff7ed;color:#9a4b12
    }
    .gcv3-feedback.ok{background:#ecfdf3;color:#05603a}
    .gcv3-feedback.compact{padding:9px 12px;align-items:center}
    .gcv3-feedback.compact b{margin:0;font-size:12.5px}
    .gcv3-feedback i{
      width:23px;height:23px;border-radius:999px;background:rgba(255,255,255,.7);display:grid;
      place-items:center;font-style:normal;font-size:12px;font-weight:900;flex:none
    }
    .gcv3-feedback b{display:block;font-size:13px;margin-bottom:3px}
    .gcv3-feedback p{margin:0;font-size:12.5px;line-height:1.5;color:inherit}
    .gcv3-tip{display:flex;justify-content:space-between;gap:12px;margin-top:12px;color:#98a2b3;font-size:11.5px}

    .gcv3-bottom{
      position:fixed;left:0;right:0;bottom:0;z-index:25;background:rgba(255,255,255,.97);
      backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:1px solid #e5e9f0;
      padding:12px 18px calc(12px + env(safe-area-inset-bottom))
    }
    .gcv3-bottomin{max-width:760px;margin:0 auto;display:flex;gap:10px}
    .gcv3-bottom .btn{
      flex:1;min-height:54px;border-radius:15px;font-size:16px;font-weight:850;
      display:flex;align-items:center;justify-content:center;gap:8px
    }
    .gcv3-bottom .btn.primary{box-shadow:0 5px 16px rgba(56,103,240,.18)}
    .gcv3-bottom .btn:disabled{box-shadow:none}

    .gcv3-recall-banner{
      display:flex;align-items:center;gap:12px;background:#fff8ef;border:1px solid #fed7aa;
      border-radius:17px;padding:13px 15px;margin-bottom:14px
    }
    .gcv3-recall-banner strong{display:block;font-size:13px;color:#9a3412}
    .gcv3-recall-banner span{display:block;font-size:12px;color:#c2410c;margin-top:2px}
    .gcv3-result{
      background:#fff;border:1px solid #e4e7ec;border-radius:26px;padding:32px 24px;text-align:center;
      box-shadow:0 10px 28px rgba(32,48,78,.055)
    }
    .gcv3-resultmark{
      width:68px;height:68px;border-radius:21px;background:#edf3ff;color:#3867f0;display:grid;
      place-items:center;margin:0 auto 16px;font-size:28px
    }
    .gcv3-result h1{font-size:27px;margin:0 0 6px}.gcv3-result>p{margin:0;color:#667085}
    .gcv3-score{font-size:56px;font-weight:920;letter-spacing:-2px;margin:22px 0 4px}
    .gcv3-score small{font-size:20px;color:#667085}
    .gcv3-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:20px}
    .gcv3-statgrid div{background:#f8fafc;border-radius:15px;padding:13px}
    .gcv3-statgrid b{display:block;font-size:19px}.gcv3-statgrid span{font-size:11px;color:#98a2b3}
    .gcv3-mastery{margin-top:15px;padding:13px;border-radius:15px;background:#ecfdf3;color:#067647;font-size:13px;font-weight:800}
    .gcv3-history{
      display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:2px;margin:0 2px 12px;
      min-height:40px;padding:3px;background:#fff;border:1px solid #e5e9f0;border-radius:13px;
      box-shadow:0 1px 3px rgba(16,24,40,.025)
    }
    .gcv3-history button{
      min-height:34px;border:0;border-radius:10px;background:transparent;color:#526075;
      padding:6px 9px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:4px
    }
    .gcv3-history button:not(:disabled):active{background:#f3f6fb}
    .gcv3-history button:disabled{opacity:.25}
    .gcv3-history .icon{width:14px;height:14px}
    .gcv3-history-status{
      min-width:75px;text-align:center;font-size:10.5px;font-weight:850;color:#7b8798;
      background:#f4f6f9;border-radius:999px;padding:6px 9px;white-space:nowrap
    }
    .gcv3-history-status.review{background:#fff7e8;color:#9a5b09}
    .gcv3-readonly-note{
      display:flex;align-items:center;gap:7px;margin:0 0 13px;padding:10px 12px;border-radius:12px;
      background:#fff9ec;color:#8b5b13;font-size:12px;font-weight:750
    }

    @media(max-width:680px){
      .gcv3{padding-bottom:112px}
      .gcv3-topin{padding:12px 14px 11px}
      .gcv3-back{width:40px;height:40px;border-radius:13px}
      .gcv3-meta strong{font-size:15px}.gcv3-meta small{font-size:11.5px}.gcv3-count{font-size:13px}
      .gcv3-progress{margin-top:11px}
      .gcv3-main{padding:18px 12px 22px}
      .gcv3-stagebar{margin:0 4px 12px}
      .gcv3-chip{height:32px;padding:0 11px;font-size:12.5px}
      .gcv3-stage small{font-size:12.5px}
      .gcv3-translate{font-size:12.5px}
      .gcv3-card{padding:20px 16px 19px;border-radius:21px}
      .gcv3-sentence-label{margin-bottom:16px}
      .gcv3-en{font-size:21px;line-height:1.62;letter-spacing:-.25px}
      .gcv3-en.medium{font-size:19.5px;line-height:1.6}
      .gcv3-en.long{font-size:18px;line-height:1.58}
      .gcv3-history{min-height:40px;margin-bottom:10px}
      .gcv3-history button{min-height:34px;padding:5px 6px;font-size:11.5px}
      .gcv3-history-status{min-width:68px;padding:6px 7px;font-size:10px}
      .gcv3-inline{min-height:34px;padding:2px 8px;border-radius:9px}
      .gcv3-divider{margin:21px 0 17px}
      .gcv3-question-title{font-size:13.5px;margin-bottom:12px}
      .gcv3-group{grid-template-columns:34px minmax(0,1fr);gap:8px}
      .gcv3-number{width:34px;min-height:54px;border-radius:12px}
      .gcv3-segment{gap:8px}
      .gcv3-option{min-height:54px;font-size:15.5px;padding:9px 7px;border-radius:13px}
      .gcv3-tip{display:none}
      .gcv3-bottom{padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
      .gcv3-bottom .btn{min-height:54px;border-radius:15px;font-size:16px}
      .gcv3-ko{font-size:13px}
    }

    @media(max-width:390px){
      .gcv3-main{padding-left:10px;padding-right:10px}
      .gcv3-card{padding-left:14px;padding-right:14px}
      .gcv3-en{font-size:19.5px}
      .gcv3-en.medium{font-size:18.5px}
      .gcv3-en.long{font-size:17.2px}
      .gcv3-option{font-size:14.5px}
      .gcv3-meta strong{font-size:14.5px}
    }
  `;
  document.head.appendChild(style);
}

function sentenceSizeClass(sentence) {
  const length = sentence.parts.reduce((sum, part) => {
    if (part[0] === 't') return sum + String(part[1] || '').length;
    return sum + Math.max(...part[1].map(option => String(option).length));
  }, 0);
  if (length >= 145) return ' long';
  if (length >= 100) return ' medium';
  return '';
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

export function openGrammarChoiceSample(A, redraw, passageId = DANWONGO_PASSAGES[0]?.id) {
  PASSAGE = getDanwongoPassage(passageId);
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
  let activeSentenceIndex = 0;
  const gradedSentences = new Set();

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
    gradedSentences.add(sentenceIndex);
    for (const { part, partIndex } of choices) {
      const ref = { sentenceIndex, partIndex, options: part[1], answer: part[2], type: part[3], help: part[4] };
      const key = choiceKey(sentenceIndex, partIndex);
      if (answers.get(key) === part[2]) firstRoundCorrect.add(key);
      else if (!firstRoundWrong.some(x => x.sentenceIndex === sentenceIndex && x.partIndex === partIndex)) firstRoundWrong.push(ref);
    }
    mountPractice();
  }

  function previousSentence() {
    if (stage !== 'practice' || sentenceIndex <= 0) return;
    sentenceIndex--;
    sentenceGraded = gradedSentences.has(sentenceIndex);
    showKo = false;
    mountPractice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function forwardSentence() {
    if (stage !== 'practice' || sentenceIndex >= activeSentenceIndex) return;
    sentenceIndex++;
    sentenceGraded = gradedSentences.has(sentenceIndex);
    showKo = false;
    mountPractice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nextSentence() {
    // While reviewing a completed sentence, move forward through history
    // without changing any saved answers.
    if (sentenceIndex < activeSentenceIndex) {
      return forwardSentence();
    }

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

    activeSentenceIndex = Math.max(activeSentenceIndex, sentenceIndex + 1);
    sentenceIndex++;
    sentenceGraded = gradedSentences.has(sentenceIndex);
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
    const isReview = sentenceIndex < activeSentenceIndex;
    const progress = Math.round(((activeSentenceIndex + 1) / PASSAGE.sentences.length) * 100);

    const groups = choices.map(({ part, partIndex }, groupIndex) => {
      const key = choiceKey(sentenceIndex, partIndex);
      const chosen = answers.get(key);
      const buttons = part[1].map(option => {
        let cls = 'gcv3-option' + (chosen === option ? ' selected' : '');
        if (sentenceGraded || isReview) {
          if (option === part[2]) cls += ' correct';
          else if (chosen === option) cls += ' wrong';
        }
        return `<button class="${cls}" data-choice-key="${key}" data-choice-value="${esc(option)}" ${sentenceGraded || isReview ? 'disabled' : ''}>${esc(option)}</button>`;
      }).join('');
      return `<div class="gcv3-group"><div class="gcv3-number">${groupIndex + 1}</div><div class="gcv3-segment">${buttons}</div></div>`;
    }).join('');

    const feedbacks = (sentenceGraded || isReview) ? choices.map(({ part, partIndex }, groupIndex) => {
      const chosen = answers.get(choiceKey(sentenceIndex, partIndex));
      const ok = chosen === part[2];
      return ok
        ? `<div class="gcv3-feedback ok compact"><i>✓</i><div><b>${groupIndex + 1}. 정답 · ${esc(part[2])}</b></div></div>`
        : `<div class="gcv3-feedback"><i>!</i><div><b>${groupIndex + 1}. 정답은 ${esc(part[2])}</b><p>${esc(part[4])}</p></div></div>`;
    }).join('') : '';

    const body = `
      <div class="gcv3-stagebar"><div class="gcv3-stage"><span class="gcv3-chip">${isReview ? '복습 보기' : '1차 · 문장 학습'}</span><small>문장 ${sentenceIndex + 1} / ${PASSAGE.sentences.length}</small></div><button class="gcv3-translate" id="gcv3-translate">${showKo ? '해석 숨기기' : '해석 보기'}</button></div>
      <div class="gcv3-history">
        <button id="gcv3-prev" ${sentenceIndex <= 0 ? 'disabled' : ''}>${icon('back')} 이전 문장</button>
        <span class="gcv3-history-status ${isReview ? 'review' : ''}">${isReview ? '완료 문장' : '현재 문장'}</span>
        <button id="gcv3-forward" ${sentenceIndex >= activeSentenceIndex ? 'disabled' : ''}>다음 문장 ${icon('arrow')}</button>
      </div>
      ${isReview ? '<div class="gcv3-readonly-note">✓ 이미 채점한 문장입니다. 답은 확인만 가능하고 수정할 수 없어요.</div>' : ''}
      <section class="gcv3-card">
        <div class="gcv3-sentence-label"><b>SENTENCE ${String(sentenceIndex + 1).padStart(2, '0')}</b><span>${isReview ? '채점 완료 · 읽기 전용' : '선택 ' + chosenCount + ' / ' + choices.length}</span></div>
        ${showKo ? `<p class="gcv3-ko">${esc(sentence.ko)}</p>` : ''}
        <div class="gcv3-en${sentenceSizeClass(sentence)}">${renderEnglish(sentence)}</div>
        <div class="gcv3-divider"></div>
        <div class="gcv3-question-title">${isReview ? '내가 선택한 답과 정답을 다시 확인하세요.' : '알맞은 표현을 하나씩 선택하세요.'}</div>
        <div class="gcv3-groups">${groups}</div>
        ${(sentenceGraded || isReview) ? `<div class="gcv3-feedbacks">${feedbacks}</div>` : ''}
        <div class="gcv3-tip"><span>${isReview ? '완료된 문장은 답을 바꿀 수 없어요.' : '한 문장 안에서 모든 괄호를 해결해요.'}</span><span>${isReview ? '다음 문장으로 돌아가 학습을 이어가세요.' : '1·2 키로 현재 선택지를 바꿀 수 있어요.'}</span></div>
      </section>`;


    const allChosen = chosenCount === choices.length;
    const bottom = isReview
      ? `<button class="btn primary" id="gcv3-next">다음 문장으로 ${icon('arrow')}</button>`
      : sentenceGraded
        ? `<button class="btn primary" id="gcv3-next">${sentenceIndex === PASSAGE.sentences.length - 1 ? (firstRoundWrong.length ? '오답 복습 시작' : '결과 보기') : '다음 문장'} ${icon('arrow')}</button>`
        : `<button class="btn primary" id="gcv3-grade" ${allChosen ? '' : 'disabled'}>문장 채점</button>`;

    mountShell(PASSAGE.source, { label: (sentenceIndex + 1) + ' / ' + PASSAGE.sentences.length, percent: progress }, body, bottom);

    $('#gcv3-translate').onclick = () => { showKo = !showKo; mountPractice(); };
    $('#gcv3-prev')?.addEventListener('click', previousSentence);
    $('#gcv3-forward')?.addEventListener('click', forwardSentence);
    $('[data-choice-key]').forEach(button => button.onclick = () => {
      if (isReview || sentenceGraded) return;
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
        <div class="gcv3-en${sentenceSizeClass(sentence)}">${renderEnglish(sentence, item.partIndex, true)}</div>
        <div class="gcv3-divider"></div>
        <div class="gcv3-question-title">이번에는 힌트 없이 다시 골라보세요.</div>
        <div class="gcv3-segment">${options}</div>
        ${recallAnswered ? (recallPick === item.answer
          ? `<div class="gcv3-feedbacks"><div class="gcv3-feedback ok compact"><i>✓</i><div><b>정답 · ${esc(item.answer)}</b></div></div></div>`
          : `<div class="gcv3-feedbacks"><div class="gcv3-feedback"><i>!</i><div><b>정답은 ${esc(item.answer)}</b><p>${esc(item.help)}</p></div></div></div>`) : ''}
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
        <h1>${mastered ? '${PASSAGE.number}번 MASTER!' : '한 번 더 다듬어 볼까요?'}</h1>
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
      activeSentenceIndex = 0;
      gradedSentences.clear();
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
