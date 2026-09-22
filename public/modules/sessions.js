import { api, $, $, icon, esc, time, date, recordRangeLabel, scope, toast, modal, buttonBusy } from './ui.js';
import { EXAM_TYPES, PRACTICE_TYPES, CHARACTERS, levelInfo } from './core.js';
import { avatar } from './character.js';
let A, redraw, refresh, examState = null, practiceState = null, prefetchedPractice = null, practiceAdvanceTimer = null, practiceOffset = 0, practiceAutoFinishing = false, practiceGuardId = null, timer, saving = Promise.resolve(), inputVersion = 0, dirty = false, syncError = '', debounce, audio;
export function configureSessions(state, render, reload) { A = state; redraw = render; refresh = reload; }
const mount = html => { $('#app').innerHTML = html; window.scrollTo(0, 0); };
const draftKey = () => `sumus:v12:exam:${A.data.profile.id}:${examState.attempt.id}`;
function localSave() {
  if (!examState || examState.attempt.status !== 'active') return;
  try { localStorage.setItem(draftKey(), JSON.stringify({ answers: examState.attempt.answers, index: examState.index, revision: examState.attempt.revision, dirty })); }
  catch { syncError = '이 기기에 임시 저장하지 못했어요. 서버 저장 상태를 확인해주세요.'; }
}
function testBackGuard() {
  if (!practiceGuardId || !practiceState || practiceState.finished || practiceState.run_mode !== 'test') return;
  history.pushState({ sumusTestGuard: practiceGuardId }, '', location.href);
  toast('실전 모드에서는 뒤로 갈 수 없어요. 시험을 끝까지 완료해주세요.');
}
function armTestGuard(id) {
  if (practiceGuardId === id) return;
  disarmTestGuard();
  practiceGuardId = id;
  history.pushState({ sumusTestGuard: id }, '', location.href);
  window.addEventListener('popstate', testBackGuard);
}
function disarmTestGuard() {
  window.removeEventListener('popstate', testBackGuard);
  practiceGuardId = null;
}
export function leaveSession() { clearInterval(timer); clearTimeout(debounce); clearTimeout(practiceAdvanceTimer); timer = null; practiceAdvanceTimer = null; prefetchedPractice = null; practiceOffset = 0; practiceAutoFinishing = false; disarmTestGuard(); A.screen = null; }
export async function openExam(eid) {
  const e = A.data.exams.find(e => e.id === eid); if (!e) return;
  const close = modal(`<span class="pill">실전시험</span><h2>${esc(e.title)}</h2><p>${e.school} · ${esc(scope(e))}</p><div class="detail-grid"><div><b>${EXAM_TYPES[e.exam_type].label}</b><small>한 가지 유형으로 출제</small></div><div><b>${e.question_count}문제</b><small>제한시간 ${Math.round(e.duration_sec / 60)}분</small></div><div><b>${e.max_attempts}회</b><small>응시 가능 횟수</small></div><div><b>${e.passing_score}점</b><small>통과 기준</small></div></div><div class="exam-info">${icon('clock')}<p>시작하면 시간이 흐릅니다.<br>시간이 끝나면 저장된 답안이 자동 제출돼요.</p></div><button class="btn ink full" id="begin-exam">${A.data.attempts.some(a => a.exam_id === eid && a.status === 'active') ? '이어서 응시하기' : '시험 시작하기'}</button>`, '실전시험 시작');
  $('#begin-exam').onclick = async e => {
    buttonBusy(e.currentTarget);
    try { const data = await api('/exams/start', { exam_id: eid }); close(); await beginExam(data); }
    catch (err) { toast(err.message); buttonBusy($('#begin-exam'), false); }
  };
}
async function beginExam(data) {
  leaveSession(); A.screen = 'exam'; examState = { ...data, index: 0, review: false, offset: data.server_time - Date.now() };
  inputVersion = 0; dirty = false; syncError = ''; saving = Promise.resolve();
  try {
    const local = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    if (local) { examState.index = Math.min(Math.max(0, local.index || 0), data.attempt.total - 1); if (local.dirty && local.revision === data.attempt.revision) { Object.assign(examState.attempt.answers, local.answers); dirty = true; } }
  } catch {}
  localSave(); renderExam();
  timer = setInterval(examTick, 500);
  if (dirty) flushDraft();
  examTick();
}
function examTick() {
  if (!examState || A.screen !== 'exam') return;
  const left = Math.ceil((examState.attempt.deadline - Date.now() - examState.offset) / 1000), el = $('#timer-value');
  if (el) el.textContent = time(left);
  $('#exam-timer')?.classList.toggle('urgent', left <= 60);
  if (left <= 0) submitExam(true);
}
function saveLabel() {
  const node = $('#save-state'); if (!node) return;
  node.classList.toggle('error', !!syncError);
  node.innerHTML = syncError ? `${esc(syncError)} <button class="text-button" id="retry-sync">다시 저장</button>` : `${icon(dirty ? 'clock' : 'check')}${dirty ? '답안 저장 중…' : '답안 저장됨'}`;
  $('#retry-sync')?.addEventListener('click', () => flushDraft());
}
function captureAnswer(value) {
  const x = examState; if (!x || x.submitting || x.attempt.status !== 'active') return;
  x.attempt.answers[x.index] = value; dirty = true; inputVersion++; localSave(); saveLabel();
  const count = Object.values(x.attempt.answers).filter(v => v?.trim()).length;
  if ($('#answered-count')) $('#answered-count').textContent = `${count} / ${x.attempt.total} 답변`;
  clearTimeout(debounce); debounce = setTimeout(flushDraft, 220);
}
async function flushDraft() {
  clearTimeout(debounce);
  const x = examState;
  saving = saving.then(async () => {
    if (!x || x !== examState || !dirty || x.attempt.status !== 'active' || x.submitting) return;
    const version = inputVersion, answers = { ...x.attempt.answers };
    try {
      const data = await api(`/attempts/${x.attempt.id}/draft`, { lease: x.attempt.lease, revision: x.attempt.revision, answers });
      x.attempt.revision = data.attempt.revision; syncError = '';
      if (data.attempt.status === 'submitted') { showExamResult(data); return; }
      if (inputVersion === version) dirty = false;
      localSave(); saveLabel();
    } catch (err) {
      syncError = err.status === 409 ? err.message : '연결이 끊겼어요. 답안은 이 기기에 보관 중이에요.';
      if (err.status === 409) {
        try {
          const remote = await api(`/attempts/${x.attempt.id}`);
          if (remote.attempt.status === 'submitted') { showExamResult(remote); return; }
          if (remote.attempt.lease === x.attempt.lease && Object.entries(answers).every(([k, v]) => remote.attempt.answers[k] === v)) {
            x.attempt.revision = remote.attempt.revision; dirty = inputVersion !== version; syncError = '';
          }
        } catch {}
      }
      localSave(); saveLabel();
    }
  });
  await saving;
}
function renderExam() {
  const x = examState, a = x.attempt, answered = Object.values(a.answers).filter(v => v?.trim()).length;
  const header = `<header class="session-header"><div class="row between"><h1>${x.review ? '최종 답안 확인' : '실전시험'}</h1><span class="exam-timer" id="exam-timer">${icon('clock')}<span id="timer-value">${time(Math.ceil((a.deadline - Date.now() - x.offset) / 1000))}</span></span></div><div class="question-count row between"><span>${esc(x.exam.title)}</span><span id="answered-count">${answered} / ${a.total} 답변</span></div><div class="progress"><i style="width:${answered / a.total * 100}%"></i></div></header>`;
  if (x.review) {
    mount(`<div class="session-app">${header}<main class="question-area"><div class="review-head"><span class="pill">제출 전 확인</span><h2>${answered === a.total ? '모든 문제에 답했어요.' : `${a.total - answered}문제가 남아 있어요.`}</h2><p>번호를 누르면 해당 답안을 수정할 수 있어요.</p></div><div class="answer-grid">${a.questions.map((q, i) => `<button data-question="${i}" class="${a.answers[i]?.trim() ? 'answered' : ''}" aria-label="${i + 1}번 ${a.answers[i]?.trim() ? '답변 완료' : '미응답'}">${i + 1}</button>`).join('')}</div><div>${a.questions.map((q, i) => `<button class="review-item" data-question="${i}"><span>${String(i + 1).padStart(2, '0')}</span><div class="grow"><p>${esc(q.prompt)}</p><small>${esc(a.answers[i] || '미응답')}</small></div>${icon('chevron')}</button>`).join('')}</div><div id="save-state" class="save-state"></div><button class="btn ink full" id="final-submit">최종 제출하기</button><button class="text-button" id="review-back" style="width:100%">문제로 돌아가기</button><div id="submit-error" role="alert"></div></main></div>`);
    $$('[data-question]').forEach(b => b.onclick = () => { x.index = Number(b.dataset.question); x.review = false; renderExam(); });
    $('#review-back').onclick = () => { x.review = false; renderExam(); };
    $('#final-submit').onclick = () => {
      const missing = a.total - Object.values(a.answers).filter(v => v?.trim()).length;
      const close = modal(`<h2>답안을 제출할까요?</h2><p>${missing ? `미응답 ${missing}문제가 있어요. ` : ''}제출 후에는 답안을 수정할 수 없어요.</p><button class="btn ink full" id="confirm-submit">제출하기</button>`, '최종 제출 확인');
      $('#confirm-submit').onclick = () => { close(); submitExam(); };
    };
  } else {
    const q = a.questions[x.index], value = a.answers[x.index] || '', writing = EXAM_TYPES[q.type].input;
    mount(`<div class="session-app">${header}<main class="question-area"><div class="row between"><span class="question-type">${EXAM_TYPES[q.type].label}</span><span class="pill">${x.index + 1} / ${a.total}</span></div><h2 class="question-prompt ${['write_en', 'mean2eng_mc'].includes(q.type) ? 'korean' : ''}">${esc(q.prompt)}</h2>${writing ? `<label><span class="hidden">${q.type === 'write_en' ? '영어 답안' : '뜻 답안'}</span><textarea rows="2" class="answer-input" id="exam-answer" aria-label="${q.type === 'write_en' ? '영어 답안' : '뜻 답안'}" placeholder="${q.type === 'write_en' ? '영어 단어를 입력하세요' : '한국어 뜻을 입력하세요'}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="500" lang="${q.type === 'write_en' ? 'en' : 'ko'}">${esc(value)}</textarea></label><p class="input-caption">${q.type === 'write_meaning' ? '뜻이 여러 개라면, 그중 하나를 정확히 적어주세요.' : '대소문자는 구분하지 않아요.'}</p>` : `<div class="options">${q.options.map((o, i) => `<button class="option ${value === o ? 'selected' : ''}" data-choice="${i}" aria-pressed="${value === o}"><span class="letter">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`}<div class="answer-controls"><button class="btn" id="exam-prev" ${x.index === 0 ? 'disabled' : ''}>${icon('back')} 이전</button><button class="btn ink" id="exam-next">${x.index === a.total - 1 ? '답안 검토' : '다음'} ${icon('arrow')}</button></div><div id="save-state" class="save-state"></div><button class="text-button" id="all-answers" style="width:100%">전체 답안 보기</button><div id="submit-error" role="alert"></div></main></div>`);
    $('#exam-answer')?.addEventListener('input', e => captureAnswer(e.target.value));
    $$('[data-choice]').forEach(b => b.onclick = () => { captureAnswer(q.options[Number(b.dataset.choice)]); $$('[data-choice]').forEach(v => { const selected = v === b; v.classList.toggle('selected', selected); v.setAttribute('aria-pressed', String(selected)); }); flushDraft(); });
    $('#exam-prev').onclick = () => { flushDraft(); x.index--; localSave(); renderExam(); };
    $('#exam-next').onclick = () => { flushDraft(); if (x.index === a.total - 1) x.review = true; else x.index++; localSave(); renderExam(); };
    $('#all-answers').onclick = () => { flushDraft(); x.review = true; renderExam(); };
  }
  saveLabel();
}
async function submitExam(auto = false) {
  const x = examState; if (!x || x.submitting || A.screen !== 'exam') return;
  if (!auto) { await flushDraft(); if (dirty && syncError) { toast('답안 저장 후 제출할 수 있어요. 연결을 확인해주세요.'); return; } }
  x.submitting = true; clearTimeout(debounce);
  $$('button,textarea', $('#app')).forEach(b => b.disabled = true);
  try {
    const result = await api(`/attempts/${x.attempt.id}/submit`, { answers: x.attempt.answers, revision: x.attempt.revision, lease: x.attempt.lease });
    showExamResult(result);
  } catch (err) {
    x.submitting = false;
    const node = $('#submit-error'); if (node) node.innerHTML = `<div class="error-box">${auto ? '시간이 종료됐어요. 서버 제출 결과를 확인 중이에요.' : esc(err.message)}<button id="retry-submit">다시 확인</button></div>`;
    $('#retry-submit')?.addEventListener('click', () => submitExam(auto));
    if (!auto) renderExam();
  }
}
export async function openResult(id) { const data = await api(`/attempts/${id}`); if (A.data.profile.role === 'teacher') {
  modal(`<span class="pill">학생 답안</span><h2>${esc(data.exam.title)}</h2><p>${data.attempt.correct} / ${data.attempt.total} 정답 · ${data.attempt.score}점</p>${data.attempt.details.map(d => `<div class="wrong-word"><span class="pill ${d.correct ? 'green' : 'red'}">${d.number}번 ${d.correct ? '정답' : '오답'}</span><p><b>${esc(d.word)}</b></p><p>${esc(d.meaning)}</p><small>학생 답안: ${esc(d.answer || '미응답')}</small></div>`).join('')}`, '시험 답안');
  } else showExamResult(data);
}
function showExamResult(data) {
  leaveSession(); if (examState) { try { localStorage.removeItem(draftKey()); } catch {} }
  A.screen = 'result'; const a = data.attempt, e = data.exam, reveal = a.score !== undefined;
  mount(`<div class="session-app"><main class="result-page"><span class="pill">${a.auto_submitted ? '시간 종료 · 자동 제출' : '제출 완료'}</span><h1>${reveal ? '실전시험을 마쳤어요.' : '답안을 제출했어요.'}</h1><p>${esc(e.title)}</p>${reveal ? `<div class="result-number">${a.score}<small>점</small></div><span class="pill ${a.score >= e.passing_score ? 'green' : ''}">${a.score >= e.passing_score ? '통과했어요' : '조금 더 연습해봐요'}</span><div class="record-stats"><div><strong>${a.correct}</strong><span>정답</span></div><div><strong>${a.total - a.correct}</strong><span>오답 · 미응답</span></div><div><strong>${a.total}</strong><span>전체 문제</span></div></div>` : `${icon('lock', 'result-lock')}<p>선생님이 결과를 공개하면<br>시험 기록에서 확인할 수 있어요.</p>`}<button class="btn ink full" id="result-home">시험 목록으로</button>${reveal ? '<button class="btn full" id="result-answers">답안 확인하기</button>' : ''}<p class="quiet-note">시험 점수는 성장 포인트와 별도로 기록돼요.</p><section id="result-details"></section></main></div>`);
  $('#result-home').onclick = async () => { leaveSession(); A.tab = 'exam'; await refresh(); redraw(); };
  $('#result-answers')?.addEventListener('click', () => {
    $('#result-details').innerHTML = a.details.map((d, index) => `<div class="wrong-word"><span class="pill ${d.correct ? 'green' : 'red'}">${d.number}번 ${d.correct ? '정답' : '오답'}</span><p><b>${esc(d.word)}</b></p><p>${esc(d.meaning)}</p><small>내 답안: ${esc(d.answer || '미응답')}</small>${!d.correct && d.type === 'write_meaning' && d.answer ? `<button class="meaning-dispute-button" data-exam-dispute="${index}">🙋 이 답도 맞는 것 같아요</button>` : ''}</div>`).join('');
    $('[data-exam-dispute]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api('/meaning-disputes', { source_type: 'exam', source_id: a.id, question_index: Number(button.dataset.examDispute) }, 'POST');
        button.textContent = '✓ 선생님께 검토 요청했어요';
        toast('뜻 이의제기를 보냈어요.');
      } catch (err) { button.disabled = false; toast(err.message); }
    }));
  });
}
export function openPracticeRecord(sessionId) {
  const session = A?.data?.sessions?.find(item => item.id === sessionId);
  if (!session) return toast('연습 기록을 찾을 수 없어요.');
  const disputes = (A.data.meaning_disputes || []).filter(item => item.source_type === 'practice' && item.source_id === session.id);
  const runLabel = session.run_mode === 'test' ? '실전 모드' : '연습 모드';
  const pending = disputes.filter(item => item.status === 'pending').length;
  const regraded = disputes.some(item => String(item.status || '').startsWith('approved')) || !!session.regraded_at;
  const score = session.score ?? (session.total ? Math.round(session.correct / session.total * 100) : 0);
  const durable = Array.isArray(session.answer_records) ? session.answer_records : [];
  const wrong = durable.length ? durable.filter(item => item.correct === false && !item.regraded) : (session.wrong_details || []).filter(item => !item.regraded);
  const wrongCount = Number.isFinite(Number(session.wrong_count)) ? Number(session.wrong_count) : wrong.length;
  const unanswered = Number.isFinite(Number(session.unanswered_count)) ? Number(session.unanswered_count) : Math.max(0, Number(session.total || 0) - Number(session.correct || 0) - wrongCount);
  const perfect = session.perfect === true || (score === 100 && wrongCount === 0 && unanswered === 0);
  const rangeText = (session.range_codes || []).map(code => esc(recordRangeLabel(session, code))).join(' · ') || '선택 범위';
  const statusText = pending ? `${score}점 (임시 · 이의제기 ${pending}건 심사중)` : regraded ? `${score}점 · 재채점 완료` : `${score}점`;
  const wrongHtml = wrong.length
    ? wrong.map(item => {
        const dispute = disputes.find(d => d.question_id === item.question_id || (d.word_id === item.word_id && d.answer === item.answer));
        const dStatus = dispute?.status === 'pending' ? ' · 이의제기 심사중' : String(dispute?.status || '').startsWith('approved') ? ' · 정답 인정' : dispute?.status === 'rejected' ? ' · 오답 유지' : '';
        const canDispute = A.data.profile.role === 'student' && item.type === 'write_meaning' && item.answer && !dispute;
        return `<div class="wrong-word"><p><b>${esc(item.word)}</b></p><p>${esc(item.meaning)}</p><small>내 답: ${esc(item.answer || '미응답')}${dStatus}</small>${canDispute ? `<button class="meaning-dispute-button" data-practice-dispute="${esc(item.question_id)}">🙋 이 답도 맞는 것 같아요</button>` : ''}</div>`;
      }).join('')
    : perfect
      ? '<div class="result-note">PERFECT · 모든 문항을 맞혔어요.</div>'
      : unanswered
        ? `<div class="result-note">미응답 ${unanswered}개 · 과거 기록은 미응답 단어 상세가 없을 수 있어요.</div>`
        : '<div class="result-note">오답 상세가 저장되지 않은 이전 기록이에요.</div>';
  const close = modal(`<span class="pill">${esc(PRACTICE_TYPES[session.mode] || '연습')} · ${runLabel}</span><h2>${esc(session.school || '')} · ${rangeText}</h2><div class="result-number">${statusText}</div><div class="detail-grid"><div><b>${session.correct} / ${session.total}</b><small>정답</small></div><div><b>${wrongCount}</b><small>오답</small></div><div><b>${unanswered}</b><small>미응답</small></div><div><b>${time(session.duration_sec || 0)}</b><small>소요시간</small></div></div><section style="margin-top:18px"><div class="section-title"><h3>답안 확인</h3></div>${wrongHtml}</section>${wrong.length && A.data.profile.role === 'student' ? '<button class="btn primary full" id="retry-wrong-practice">틀린 단어만 다시 연습</button>' : ''}`, '내 연습 기록');
  $$('[data-practice-dispute]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await api('/meaning-disputes', { source_type: 'practice', source_id: session.id, question_id: button.dataset.practiceDispute }, 'POST');
      button.textContent = '✓ 선생님께 검토 요청했어요';
      toast('뜻 이의제기를 보냈어요.');
    } catch (error) { button.disabled = false; toast(error.message); }
  }));
  $('#retry-wrong-practice')?.addEventListener('click', async event => {
    buttonBusy(event.currentTarget);
    try {
      close();
      A.mode = session.mode || 'write_meaning';
      await startPractice({ wordIds: [...new Set(wrong.map(item => item.word_id).filter(Boolean))], mode: session.mode, runMode: 'practice' });
    } catch (error) { toast(error.message); }
  });
}
export async function startPractice(options = {}) {
  const old = A.data.active_practice;
  const payload = options.dailyQuest
    ? { school: A.school, mode: 'write_meaning', target: 20, daily_quest: true, run_mode: 'practice' }
    : Array.isArray(options.wordIds) && options.wordIds.length
      ? { school: A.school, mode: options.mode || A.mode || 'write_meaning', word_ids: options.wordIds, cover_all: true, run_mode: options.runMode || 'practice' }
      : A.data.profile.division === 'middle'
        ? { school: A.school, mode: A.mode, word_ids: A.middleWordIds || [], cover_all: true, run_mode: options.runMode || A.practiceRunMode || 'practice' }
        : { school: A.school, range_codes: A.ranges[A.school], mode: A.mode, target: A.target === 'all' ? undefined : A.target, cover_all: A.target === 'all', assignment_id: A.assignmentId, run_mode: options.runMode || A.practiceRunMode || 'practice' };
  const data = old ? await api(`/practice/${old}`) : await api('/practice/start', payload);
  leaveSession(); practiceState = data; practiceOffset = Number(data.server_time || Date.now()) - Date.now(); prefetchedPractice = null; A.screen = 'practice'; if (data.run_mode === 'test') armTestGuard(data.id); renderPractice();
}
function renderPractice() {
  const x = practiceState; if (x.finished) return finishPracticeView();
  clearInterval(timer);
  timer = x.deadline ? setInterval(practiceTick, 500) : null;
  const q = x.question, feedback = x.feedback, input = !q.options.length, answer = feedback ? ['mean2eng', 'spell', 'scramble', 'initial', 'vowelblank'].includes(q.type) ? feedback.word : feedback.meaning : '';
  const meaningInput = q.type === 'write_meaning';
  const testMode = x.run_mode === 'test';
  const left = x.deadline ? Math.max(0, Math.ceil((x.deadline - Date.now() - practiceOffset) / 1000)) : 0;
  mount(`<div class="session-app"><header class="session-header"><div class="row between">${testMode ? '<span class="test-lock-mark" aria-label="실전 모드 잠금">' + icon('lock') + '</span>' : '<button class="icon-button" id="practice-exit" aria-label="연습 종료">' + icon('close') + '</button>'}<h1>${x.school} · ${testMode ? '실전 테스트' : ['write_meaning','spell'].includes(x.mode) ? '단어 테스트' : '연습'}</h1><div class="row" style="gap:8px"><span class="exam-timer ${left <= 60 ? 'urgent' : ''}" id="practice-timer">${icon('clock')}<span id="practice-timer-value">${time(left)}</span></span><button class="icon-button" id="practice-sound" aria-label="효과음 ${A.sound ? '끄기' : '켜기'}">${icon(A.sound ? 'sound' : 'mute')}</button></div></div><div class="question-count row between"><span>${Math.min(Number(x.score_total || 0) + (!feedback && !x.question_is_retry ? 1 : 0), x.target)} / ${x.target}${x.question_is_retry || (Number(x.score_total || 0) >= x.target && x.retry_count) ? ' · 오답 복습' : ''}</span><div class="practice-score"><span>${testMode ? '채점은 마지막에 공개' : x.total ? x.score + '점' : '100점 도전'}</span>${testMode ? '' : '<b>+' + x.xp + 'P</b>'}</div></div><div class="progress"><i style="width:${Math.min(100, Number(x.score_total || 0) / x.target * 100)}%"></i></div></header><main class="question-area"><div class="row between"><span class="question-type">${PRACTICE_TYPES[q.type]}</span><span class="pill blue">${testMode ? '실전 모드' : x.daily_quest ? '오늘의 퀘스트' : x.cover_all ? '범위 전체' : '연습 모드'}</span></div>${q.type === 'listen' ? `<button class="listen-button" id="listen-word" aria-label="발음 듣기">${icon('sound')}</button><p class="input-caption" style="text-align:center">발음을 듣고 뜻을 골라주세요.</p>` : `<h2 class="question-prompt ${!['eng2mean', 'write_meaning'].includes(q.type) ? 'korean' : ''}">${esc(q.prompt)}</h2>`}${q.hint ? `<p class="question-hint">${esc(q.hint)}</p>` : ''}${input ? `<input id="practice-answer" class="answer-input" aria-label="${meaningInput ? '한국어 뜻 답안' : '영어 답안'}" placeholder="${meaningInput ? '뜻을 직접 입력하세요' : '영어 단어를 입력하세요'}" autocomplete="off" autocapitalize="off" spellcheck="false" ${feedback ? 'disabled' : ''}><button class="btn primary full" id="practice-confirm" style="margin-top:13px" ${feedback ? 'disabled' : ''}>${testMode ? '답안 제출' : '정답 확인'}</button>` : `<div class="options">${q.options.map((o, i) => `<button class="option ${feedback && o === answer ? 'correct' : ''}" data-practice-choice="${i}" ${feedback ? 'disabled' : ''}><span class="letter">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`}<div id="practice-feedback">${feedback ? feedbackHtml(feedback) : ''}</div>${feedback ? `<button class="btn primary full" id="practice-next" style="margin-top:18px">${x.total >= x.target && !x.retry_count ? '연습 마치기' : '다음 단어'} ${icon('arrow')}</button>` : ''}<div id="practice-error" role="alert"></div></main></div>`);
  if ($('#practice-exit')) $('#practice-exit').onclick = () => { const close = modal(`<h2>여기까지 기록할까요?</h2><p>지금까지 푼 ${x.total}문제와 포인트를 저장해요.</p><button class="btn primary full" id="practice-finish">저장하고 마치기</button>`, '연습 종료'); $('#practice-finish').onclick = async () => { try { practiceState = await api(`/practice/${x.id}/finish`, {}); close(); finishPracticeView(); } catch (e) { toast(e.message); } }; };
  $('#practice-sound').onclick = () => { A.sound = !A.sound; try { localStorage.setItem('sumus:sound', String(A.sound)); } catch {} renderPractice(); };
  $('#listen-word')?.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return toast('이 기기에서는 듣기를 지원하지 않아요. 다른 연습 방식을 이용해주세요.');
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(q.audio); u.lang = 'en-US'; u.rate = .85; u.onerror = () => toast('소리를 재생하지 못했어요. 다시 눌러주세요.'); speechSynthesis.speak(u);
  });
  $$('[data-practice-choice]').forEach(b => b.onclick = () => answerPractice(q.options[Number(b.dataset.practiceChoice)], b));
  $('#practice-confirm')?.addEventListener('click', () => { const value = $('#practice-answer').value; if (!value.trim()) return toast('답을 입력해주세요.'); answerPractice(value); });
  $('#practice-answer')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) $('#practice-confirm')?.click(); });
  $('#practice-next')?.addEventListener('click', e => advancePracticeScreen(e.currentTarget, x));
  $('#practice-dispute')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api('/meaning-disputes', { source_type: 'practice', source_id: x.id, question_id: feedback.question_id }, 'POST');
      button.textContent = '✓ 선생님께 검토 요청했어요';
      toast('뜻 이의제기를 보냈어요.');
    } catch (err) { button.disabled = false; toast(err.message); }
  });
}
function renderPracticeFinishPending(error = '') {
  if (!practiceState) return;
  const expired = Number(practiceState.deadline || 0) > 0;
  mount(`<div class="session-app"><main class="result-page"><span class="pill">시간 종료</span><h1>제출 상태를 확인하고 있어요.</h1><p>${expired ? '제한시간은 이미 종료됐어요. 답안을 더 수정할 수 없습니다.' : '학습 종료 상태를 확인하고 있어요.'}</p>${error ? `<div class="error-box">${esc(error)}</div><button class="btn primary full" id="practice-finish-retry">제출 상태 다시 확인</button>` : '<div class="result-note">잠시만 기다려주세요.</div>'}</main></div>`);
  $('#practice-finish-retry')?.addEventListener('click', () => finishPracticeByTimer());
}
async function finishPracticeByTimer() {
  if (practiceAutoFinishing || !practiceState || practiceState.finished) return;
  practiceAutoFinishing = true;
  clearInterval(timer); timer = null;
  renderPracticeFinishPending();
  try {
    practiceState = await api(`/practice/${practiceState.id}/finish`, {});
    practiceOffset = Number(practiceState.server_time || Date.now()) - Date.now();
    finishPracticeView();
  } catch (error) {
    practiceAutoFinishing = false;
    renderPracticeFinishPending(error.message || '제출 상태를 확인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.');
  }
}
function practiceTick() {
  const x = practiceState;
  if (!x || x.finished || !x.deadline) return;
  const left = Math.max(0, Math.ceil((x.deadline - Date.now() - practiceOffset) / 1000));
  const value = $('#practice-timer-value');
  if (value) value.textContent = time(left);
  $('#practice-timer')?.classList.toggle('urgent', left <= 60);
  if (left <= 0) finishPracticeByTimer();
}
function feedbackHtml(f) { return `<div class="feedback ${f.ok ? '' : 'wrong shake'}" role="status"><span class="gain">${f.ok ? '+' + f.gain + 'P' : ''}</span><b>${f.ok ? `정답! ${f.combo > 1 ? f.combo + '연속 성공' : '제대로 맞혔어요'}` : '기억해두면, 다시 맞힐 수 있어요'}</b><p>${f.ok ? `숙련도 ${f.mastery}% 상승` : `${esc(f.word)} · ${esc(f.meaning)}<br>내 답: ${esc(f.answer || '')}<br>잠시 뒤 다시 나와요.`}</p><div class="progress"><i style="width:${f.mastery}%"></i></div></div>${f.can_dispute ? '<button class="meaning-dispute-button" id="practice-dispute">🙋 이 답도 맞는 것 같아요</button>' : ''}${f.milestone ? `<div class="milestone-toast">${f.combo}연속 정답. 좋은 흐름이에요.</div>` : ''}`; }
let answering = false;
async function advancePracticeScreen(button, answeredState) {
  if (practiceState !== answeredState) return;
  clearTimeout(practiceAdvanceTimer); practiceAdvanceTimer = null;
  if (prefetchedPractice) {
    practiceState = prefetchedPractice; prefetchedPractice = null; renderPractice(); return;
  }
  buttonBusy(button);
  try { practiceState = await api(`/practice/${answeredState.id}/next`, {}); renderPractice(); }
  catch (err) { toast(err.message); buttonBusy($('#practice-next'), false); }
}
async function answerPractice(answer, button) {
  if (answering || practiceState.feedback) return;
  answering = true; const x = practiceState;
  $$('[data-practice-choice],#practice-confirm').forEach(b => b.disabled = true);
  try { const result = await api(`/practice/${x.id}/answer`, { question_id: x.question_id, answer, prefetch_next: true });
    practiceOffset = Number(result.server_time || Date.now()) - Date.now();
    if (result.finished) { prefetchedPractice = null; practiceState = result; finishPracticeView(); return; }
    if (result.run_mode === 'test') {
      prefetchedPractice = null;
      practiceState = result;
      renderPractice();
      return;
    }
    prefetchedPractice = result.prefetched_next || null; delete result.prefetched_next; practiceState = result; renderPractice();
    if (!result.feedback.ok && button) { const index = button.dataset.practiceChoice; $(`[data-practice-choice="${index}"]`)?.classList.add('wrong'); }
    if (result.feedback.ok) navigator.vibrate?.([24, 34, 42]); else navigator.vibrate?.([12, 25, 12]);
    if (A.sound) sound(result.feedback.ok, result.feedback.milestone);
    // Correct answers stay visible long enough to read the feedback, then move on automatically.
    // Students can still tap the next button immediately; wrong answers stay visible for review.
    if (result.feedback.ok && prefetchedPractice) {
      clearTimeout(practiceAdvanceTimer);
      practiceAdvanceTimer = setTimeout(() => advancePracticeScreen($('#practice-next'), result), 3000);
    }
  } catch (e) { $('#practice-error').innerHTML = `<div class="error-box">${esc(e.message)} 답안은 다시 눌러 전송할 수 있어요.</div>`; $$('[data-practice-choice],#practice-confirm').forEach(b => b.disabled = false); }
  finally { answering = false; }
}
function sound(ok, milestone) {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); const t = audio.currentTime; const notes = ok ? milestone ? [523, 659, 784] : [660, 880] : [220]; notes.forEach((f, i) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + i * .065); g.gain.exponentialRampToValueAtTime(.035, t + i * .065 + .01); g.gain.exponentialRampToValueAtTime(.0001, t + i * .065 + .15); o.connect(g); g.connect(audio.destination); o.start(t + i * .065); o.stop(t + i * .065 + .16); }); } catch {}
}
function finishPracticeView() {
  clearInterval(timer); timer = null; disarmTestGuard(); practiceAutoFinishing = false;
  const x = practiceState; A.screen = 'result'; const before = A.data.stats.level, after = x.stats.level;
  const score = Number(x.score || 0);
  const endedAt = Number(x.ended_at || x.finished_at || Date.now());
  const elapsed = Math.max(0, Math.round((endedAt - Number(x.started_at || endedAt)) / 1000));
  const durable = Array.isArray(x.answer_records) ? x.answer_records : [];
  const wrong = durable.length ? durable.filter(item => item.correct === false && !item.regraded) : (x.wrong_details || []).filter(item => !item.regraded);
  const wrongCount = Number.isFinite(Number(x.wrong_count)) ? Number(x.wrong_count) : wrong.length;
  const unanswered = Number.isFinite(Number(x.unanswered_count)) ? Number(x.unanswered_count) : Math.max(0, Number(x.target || 0) - Number(x.score_total || 0));
  const perfect = x.perfect === true || (score === 100 && wrongCount === 0 && unanswered === 0);
  const wrongHtml = wrong.length ? `<section style="margin-top:18px;text-align:left"><div class="section-title"><h2>틀린 단어 ${wrongCount}개</h2></div>${wrong.slice(0,30).map(item => `<div class="wrong-word"><p><b>${esc(item.word)}</b> · ${esc(item.meaning)}</p><small>내 답: ${esc(item.answer || '미응답')}</small>${item.type === 'write_meaning' && item.answer ? `<button class="meaning-dispute-button" data-finish-practice-dispute="${esc(item.question_id)}">🙋 이 답도 맞는 것 같아요</button>` : ''}</div>`).join('')}</section>` : '';
  const statusNote = perfect
    ? '<div class="result-note">PERFECT · 모든 문항을 맞혔어요.</div>'
    : unanswered
      ? `<div class="result-note">미응답 ${unanswered}개가 점수 분모에 포함됐어요.</div>`
      : wrongCount
        ? ''
        : '<div class="result-note">답안 상세를 확인할 수 없는 이전 기록이에요.</div>';
  mount(`<div class="session-app"><main class="result-page"><span class="pill blue">${x.auto_submitted ? '시간 종료 · 자동 제출' : '기록 저장 완료'}</span><h1>${x.run_mode === 'test' ? '실전 테스트 결과' : ['write_meaning','spell'].includes(x.mode) ? '단어 테스트 결과' : '연습 결과'}</h1><p>${esc(PRACTICE_TYPES[x.mode] || '연습')} · ${x.run_mode === 'test' ? '실전 모드 · ' : '연습 모드 · '} ${(x.range_codes || []).map(code => esc(recordRangeLabel({ division: A.data.profile.division, school: x.school }, code))).join(' · ')}</p><div class="result-number">${score}<small>점</small></div><div class="record-stats"><div><strong>${Number(x.score_correct || 0)}</strong><span>정답</span></div><div><strong>${wrongCount}</strong><span>오답</span></div><div><strong>${unanswered}</strong><span>미응답</span></div><div><strong>${time(elapsed)}</strong><span>소요시간</span></div></div><div class="result-note">성장 포인트 +${x.xp}P · 최고 ${x.best}연속${x.auto_submitted ? ' · 제한시간 종료' : ''}</div>${wrongHtml}${statusNote}<button class="btn primary full" id="practice-records">내 기록 보기</button><button class="btn full" id="practice-home">홈으로 돌아가기</button></main></div>`);
  $$('[data-finish-practice-dispute]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await api('/meaning-disputes', { source_type: 'practice', source_id: x.id, question_id: button.dataset.finishPracticeDispute }, 'POST');
      button.textContent = '✓ 선생님께 검토 요청했어요';
      toast('뜻 이의제기를 보냈어요.');
    } catch (error) { button.disabled = false; toast(error.message); }
  }));
  const go = async tab => { leaveSession(); A.tab = tab; await refresh(); redraw(); };
  $('#practice-home').onclick = () => go('home'); $('#practice-records').onclick = () => go('records');
}
window.addEventListener('online', () => { if (A?.screen === 'exam') flushDraft(); if (A?.screen === 'practice' && practiceState && !practiceState.finished && Number(practiceState.deadline || 0) <= Date.now() + practiceOffset) finishPracticeByTimer(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') return; if (A?.screen === 'exam') { examTick(); flushDraft(); } if (A?.screen === 'practice' && practiceState && !practiceState.finished && Number(practiceState.deadline || 0) <= Date.now() + practiceOffset) finishPracticeByTimer(); });
window.addEventListener('pagehide', () => { if (A?.screen === 'exam') localSave(); });
