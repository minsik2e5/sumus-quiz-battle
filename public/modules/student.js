import { CHARACTERS, ACCESSORIES, FRAMES, TITLES, PRACTICE_TYPES, EXAM_TYPES, unlocked, levelInfo, dayKey } from './core.js';
import { icon, esc, num, date, rangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar } from './character.js';
import { DANWONGO_PASSAGES } from '../danwongo-grammar-data.js?v=2';
import { SEONBU_2025_PASSAGES, SEONBU_2026_PASSAGES } from '../seonbu-grammar-data.js?v=2';
import { GANGSEO_PASSAGES } from '../gangseo-grammar-data.js?v=1';
export const studentTabs = [['home', '홈', 'home'], ['practice', '학습', 'practice'], ['exam', '시험', 'exam'], ['ranking', '랭킹', 'ranking'], ['records', '기록', 'records']];
export function shell(A, content) {
  const p = A.data.profile;
  return `<div class="student-app"><main class="student-main"><header class="app-header"><div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><button class="profile-dot" data-action="account" aria-label="내 계정">${esc(p.display_name.slice(0, 1))}</button></header>${content}</main><nav class="bottom-nav" aria-label="주 메뉴">${studentTabs.map(([id, name, i]) => `<button data-go="${id}" class="${A.tab === id ? 'active' : ''}" ${A.tab === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${name}</span></button>`).join('')}</nav></div>`;
}
export function studentPage(A) {
  return shell(A, ({ home, practice, exam, ranking, records, studio }[A.tab] || home)(A));
}
export function getRanges(A, school = A.school, grade = null) {
  const books = A.data.books.filter(book => !grade || !book.grade || book.grade === grade);
  const words = books.flatMap(book => book.words || []);
  const codes = [...new Set(words.map(w => w.range_code))];
  const key = grade ? school + '::' + grade : school;
  A.ranges[key] ??= codes.slice(0, 2);
  A.ranges[key] = A.ranges[key].filter(code => codes.includes(code));
  return { words, codes, selected: A.ranges[key], key };
}
export function selectedCount(A, grade = null) { const { words, selected } = getRanges(A, A.school, grade); return words.filter(w => selected.includes(w.range_code)).length; }
export function schoolSwitch(A) {
  const school = A.data.profile.school || A.school || '학교 미설정';
  return `<section class="study-school-card compact locked"><div><span class="tiny muted">내 학교</span><strong>${esc(school)}</strong></div><span class="school-fixed">${icon('shield')} 선생님 관리</span></section>`;
}
function wordQuestState(A, code) {
  return A.data.word_mastery?.ranges?.[String(code)] || null;
}
function wordQuestMeta(state) {
  if (!state) return { label: '깨야 할 퀘스트', cls: 'quest', detail: '아직 미도전' };
  const achievement = Number(state.achievement_accuracy ?? state.accuracy ?? 0);
  const recentReady = state.achievement_source === 'recent30';
  const scoreLabel = recentReady ? `최근 성취 ${achievement}%` : `정답률 ${achievement}%`;
  if (state.status === 'perfect') return { label: 'PERFECT MASTER', cls: 'perfect', detail: scoreLabel };
  if (state.status === 'master') return { label: 'WORD MASTER', cls: 'master', detail: scoreLabel };
  if (state.status === 'needs_work') return { label: '수련 필요', cls: 'needs-work', detail: scoreLabel };
  if (state.status === 'quest') return { label: '깨야 할 퀘스트', cls: 'quest', detail: '아직 미도전' };
  return { label: '정복 진행 중', cls: 'progressing', detail: `${state.attempted}/${state.total} 단어 · ${scoreLabel}` };
}
function todayWordQuest(A, goal = 20) {
  const wm = A.data.word_mastery;
  const g = A.data.stats;
  const school = A.data.profile.school || A.school || '';
  const states = Object.values(wm?.ranges || {});
  const priority = state => state.status === 'needs_work' ? 0
    : ['conquering','in_progress'].includes(state.status) ? 1
    : state.status === 'quest' ? 2
    : state.status === 'master' ? 3
    : state.status === 'perfect' ? 4 : 2;
  const next = [...states].sort((a,b) => priority(a) - priority(b) || Number(a.range_code) - Number(b.range_code))[0] || null;
  const meta = next ? wordQuestMeta(next) : { label: '시험범위 선택', cls: 'quest', detail: '학습에서 범위를 확인하세요' };
  const done = Math.min(Number(g.today_total || 0), goal);
  const mastered = wm?.mastered || 0;
  const totalRanges = wm?.total_ranges || states.length;
  const conquest = wm?.conquest || 0;
  const active = Boolean(A.data.active_practice);
  const daily = A.data.daily_quest || { target: 0, mix: { wrong: 0, review: 0, new: 0 } };
  const mix = daily.mix || { wrong: 0, review: 0, new: 0 };
  const nextText = active ? '진행 중인 연습 이어가기'
    : daily.target > 0 ? `오답 ${mix.wrong || 0} · 복습 ${mix.review || 0} · 새 단어 ${mix.new || 0}`
    : next ? `${next.range_code}번 · ${meta.label}`
    : '시험범위에서 시작하기';

  return `<div class="section-title compact-home-title"><h2>오늘의 단어 퀘스트</h2><span class="tiny muted">오늘 ${done} / ${goal}</span></div>
    <section class="today-word-quest">
      <div class="today-word-top">
        <div><span class="eyebrow">WORD QUEST</span><h2>${esc(school)} 시험범위 정복</h2></div>
        <strong class="today-word-percent">${conquest}%</strong>
      </div>
      <div class="today-word-progress"><i style="width:${conquest}%"></i></div>
      <div class="today-word-stats">
        <span><b>${mastered} / ${totalRanges}</b><small>MASTER</small></span>
        <span><b>${num(g.today_total || 0)}</b><small>오늘 학습</small></span>
        <span><b>+${num(g.today_xp || 0)}P</b><small>오늘 포인트</small></span>
      </div>
      <div class="today-word-next"><span>다음 퀘스트</span><strong>${esc(nextText)}</strong></div>
      <button class="btn primary full today-word-start" data-quick-practice="true"><span>${active ? '하던 연습 이어가기' : daily.target > 0 ? `오늘 ${daily.target}개 시작하기` : '시험범위 확인하기'}</span>${icon('arrow')}</button>
      <button class="today-word-detail" data-study="vocab">시험범위 전체 보기 ${icon('chevron')}</button>
    </section>`;
}
export function rangePicker(A, teacher = false, grade = null) {
  const { words, codes, selected } = getRanges(A, A.school, grade);
  return `<div class="${teacher ? 'teacher-range' : 'range-grid'}">${codes.map(c => {
    const state = !teacher ? wordQuestState(A, c) : null;
    const meta = !teacher ? wordQuestMeta(state) : null;
    return `<label class="range-option ${meta ? 'quest-range ' + meta.cls : ''}"><input type="checkbox" data-range="${c}" ${grade ? `data-range-grade="${esc(grade)}"` : ''} ${selected.includes(c) ? 'checked' : ''} aria-label="${esc(rangeLabel(A.school, c))}"><span>${esc(rangeLabel(A.school, c))}<small>${words.filter(w => w.range_code === c).length}개 단어${meta ? ' · ' + meta.detail : ''}</small>${meta ? `<em class="quest-status ${meta.cls}">${meta.label}</em>` : ''}</span></label>`;
  }).join('')}</div><div class="scope-tools"><span id="scope-count">${selected.length}개 범위 · ${selectedCount(A, grade)}개 단어</span><div><button data-range-all="true">전체 선택</button><button data-range-all="false">해제</button></div></div>`;
}
function grammarPassagesForSchool(school) {
  if (school === '단원고') return DANWONGO_PASSAGES;
  if (school === '선부고') return [...SEONBU_2026_PASSAGES, ...SEONBU_2025_PASSAGES];
  if (school === '강서고') return GANGSEO_PASSAGES;
  return [];
}
function grammarExamLabel(passage) {
  return passage.id.startsWith('2026-06-busan') ? '2026년 6월 부산교육청'
    : passage.id.startsWith('2026-03-seoul') ? '2026년 3월 서울교육청'
    : '2025년 9월 인천교육청';
}
function savedGrammarProgress(A, passage) {
  const server = A.data.grammar_progress?.[passage.id];
  if (server) return server;
  try { return JSON.parse(localStorage.getItem('sumus:grammar-master:' + A.data.profile.id + ':' + passage.id) || 'null'); }
  catch { return null; }
}
function grammarHomeCard(A) {
  const school = A.data.profile.school || A.school || '';
  const passages = grammarPassagesForSchool(school);
  if (!passages.length) return '';
  const completed = passages.filter(p => savedGrammarProgress(A, p)?.mastered).length;
  const target = passages.find(p => !savedGrammarProgress(A, p)?.mastered) || passages[0];
  const progress = savedGrammarProgress(A, target);
  const allMastered = completed === passages.length;
  const detail = allMastered
    ? '시험범위 전체 MASTER · 필요하면 다시 복습하세요.'
    : progress?.completed_sentences
      ? `${progress.completed_sentences} / ${target.sentences.length}문장 진행 중 · 이어서 학습`
      : `${target.sentences.length}문장 · 지금 시작하기`;
  return `<div class="section-title"><h2>오늘의 시험대비</h2><span class="tiny muted">${completed} / ${passages.length} MASTER</span></div>
    <button class="exam-row exam-range-row" data-action="grammar-choice" data-grammar-id="${esc(target.id)}">
      <span class="square-icon">${icon(allMastered ? 'check' : 'records')}</span>
      <div class="grow"><h3>${esc(school)} · ${esc(target.number)}번</h3><p>${esc(grammarExamLabel(target))} · ${esc(detail)}</p></div>
      ${icon('chevron')}
    </button>`;
}
function home(A) {
  const { profile: p, stats: g, exams, assignments } = A.data, c = CHARACTERS[p.avatar_key] || CHARACTERS.lumi;
  const available = exams.filter(e => e.due_at > Date.now()).slice(0, 2);
  const task = assignments.find(a => a.due_at > Date.now()), goal = 20;
  return `<div class="row between"><div><p class="hello">${esc(p.display_name)}님, 반가워요</p><h1 class="home-title">오늘도, 한 걸음 더.</h1></div>${g.streak ? `<span class="streak-badge">${icon('flame')}${g.streak}일째</span>` : ''}</div>
  <section class="character-hero" aria-label="내 캐릭터 성장"><div class="hero-top"><div><b class="eyebrow">${c.name}</b><small>${c.type}</small></div><span class="pill">${esc(TITLES[p.avatar_title || 'rookie']?.name || '첫걸음')}</span></div><div class="character-stage">${avatar(p.avatar_key, { stage: g.stage, accessory: p.avatar_accessory, frame: p.avatar_frame })}</div><div class="hero-growth"><div class="row between"><strong>Lv.${String(g.level).padStart(2, '0')}<span>${c.ko}</span></strong><button class="text-button" data-go="studio">내 캐릭터 ${icon('chevron')}</button></div><div class="progress" role="progressbar" aria-label="캐릭터 성장" aria-valuenow="${Math.round(g.percent)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${g.percent}%"></i></div><div class="growth-caption"><span>${g.level === 50 ? '최고 레벨에 도달했어요' : `다음 레벨까지 ${num(g.remaining)}P`}</span><span>${num(g.current)} / ${num(g.need)}P</span></div></div></section>
  ${todayWordQuest(A, goal)}
  ${grammarHomeCard(A)}
  ${task ? `<div class="section-title"><h2>선생님이 남긴 연습</h2></div><button class="exam-row" data-assignment="${task.id}"><span class="square-icon">${icon('practice')}</span><div class="grow"><h3>${esc(task.title)}</h3><p>${task.target_questions}문제 · ${date(task.due_at)}까지</p></div>${icon('chevron')}</button>` : ''}
  <div class="section-title"><h2>배정된 실전시험</h2><button class="text-button" data-go="exam">모두 보기 ${icon('chevron')}</button></div>${available.length ? available.map(e => `<button class="exam-row" data-exam="${e.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><h3>${esc(e.title)}</h3><p>${EXAM_TYPES[e.exam_type].label} · ${e.question_count}문제</p></div>${icon('chevron')}</button>`).join('') : `<p class="quiet-note">지금은 배정된 시험이 없어요.</p>`}`;
}
function studyHub(A) {
  const school = A.data.profile.school || A.school || '학교 미설정';
  return `<div class="page-heading"><h1>무엇을 공부할까요?</h1><p>오늘 필요한 학습을 골라 바로 시작하세요.</p></div>
  <section class="study-school-card locked"><div><span class="tiny muted">현재 학교</span><strong>${esc(school)}</strong></div><span class="school-fixed">${icon('shield')} 선생님 관리</span></section>
  <div class="study-hub-grid">
    <button class="study-hub-card vocab" data-study="vocab">
      <span class="study-hub-icon">${icon('practice')}</span>
      <div><span class="pill blue">VOCAB</span><h2>단어 학습</h2><p>영어↔뜻, 철자, 듣기, 스크램블까지<br>약한 단어를 반복해서 익혀요.</p></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>
    <button class="study-hub-card grammar" data-study="grammar">
      <span class="study-hub-icon">${icon('records')}</span>
      <div><span class="pill">GRAMMAR</span><h2>어법·어휘</h2><p>모의고사 지문을 문장 단위로 풀고<br>틀린 선택지만 다시 복습해요.</p></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>
  </div>
  <section class="study-tip"><span class="square-icon">${icon('sparkle')}</span><div><b>추천 학습 흐름</b><p>단어로 기본기를 익힌 뒤, 어법·어휘에서 실제 문장 속 쓰임을 확인해보세요.</p></div></section>`;
}

function grammarCards(A, passages) {
  return passages.map(p => {
    const sentenceCount = p.sentences.length;
    const examLabel = grammarExamLabel(p);
    const choiceCount = p.sentences.reduce((sum, sentence) => sum + sentence.parts.filter(part => part[0] === 'c').length, 0);
    const saved = savedGrammarProgress(A, p);
    const mastered = Boolean(saved?.mastered);
    return `<button class="grammar-set-card premium ${mastered ? 'mastered' : ''}" data-action="grammar-choice" data-grammar-id="${esc(p.id)}">
      <div class="grammar-set-top">
        <span class="grammar-number">${esc(p.number)}</span>
        <div class="grow"><b>${esc(p.subtitle)}</b><small>${examLabel}</small></div>
        <span class="grammar-state ${mastered ? 'master' : ''}">${mastered ? 'MASTER' : '미학습'}</span>
      </div>
      <div class="grammar-set-meta"><span>${sentenceCount}문장</span><span>${choiceCount}개 선택</span><span>${mastered ? '1차 ' + Number(saved.firstRate || 0) + '%' : '오답 리콜'}</span></div>
      <div class="grammar-set-cta">${mastered ? '다시 학습' : '학습 시작'} ${icon('arrow')}</div>
    </button>`;
  }).join('');
}

function grammarStudy(A) {
  const school = A.data.profile.school || A.school || '';
  const isDanwon = school === '단원고';
  const isSeonbu = school === '선부고';
  const isGangseo = school === '강서고';
  const passages = isDanwon ? DANWONGO_PASSAGES : isGangseo ? GANGSEO_PASSAGES : [];

  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill blue">GRAMMAR</span></div>
  <div class="page-heading grammar-heading"><h1>어법·어휘</h1><p>WORKBOOK 6 선택지만 그대로 풀고, 분석본 기준으로 오답을 정리해요.</p></div>
  <section class="study-school-card locked"><div><span class="tiny muted">현재 학교</span><strong>${esc(school)}</strong></div><span class="school-fixed">${icon('shield')} 선생님 관리</span></section>
  ${isDanwon ? `
    <section class="grammar-range-head"><div><span class="eyebrow">단원고 시험범위</span><h2>2025년 9월 인천교육청</h2><p>WORKBOOK 6 원문 선택지 · 분석본 기준 채점 해설</p></div><span class="grammar-range-count">${passages.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, passages)}</div>
    <p class="quiet-note">범위: 24 · 29 · 31 · 32 · 33 · 34 · 36 · 39 · 40 · 41~42</p>
  ` : isGangseo ? `
    <section class="grammar-range-head gangseo"><div><span class="eyebrow">강서고 시험범위 · 2026</span><h2>2026년 6월 부산교육청</h2><p>WORKBOOK 6 원문 선택지 · 지문분석 기준 채점 해설</p></div><span class="grammar-range-count">${GANGSEO_PASSAGES.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, GANGSEO_PASSAGES)}</div>
    <p class="quiet-note">범위: 21 · 23 · 29 · 30 · 31 · 32 · 33 · 34 · 36 · 37 · 38 · 39 · 40</p>
  ` : isSeonbu ? `
    <section class="grammar-range-head seonbu current"><div><span class="eyebrow">선부고 시험범위 · 2026</span><h2>2026년 3월 서울교육청</h2><p>WORKBOOK 6 원문 선택지 · 분석본 기준 채점 해설</p></div><span class="grammar-range-count">${SEONBU_2026_PASSAGES.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, SEONBU_2026_PASSAGES)}</div>
    <p class="quiet-note">범위: 20 · 23 · 24 · 32</p>

    <div class="grammar-year-divider"><span>2025년 범위</span></div>
    <section class="grammar-range-head seonbu old"><div><span class="eyebrow">선부고 시험범위 · 2025</span><h2>2025년 9월 인천교육청</h2><p>WORKBOOK 6 원문 선택지 · 분석본 기준 채점 해설</p></div><span class="grammar-range-count">${SEONBU_2025_PASSAGES.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, SEONBU_2025_PASSAGES)}</div>
    <p class="quiet-note">범위: 31 · 34 · 36 · 38 · 40 · 43~45</p>
  ` : `
    <section class="grammar-empty-school"><span class="square-icon">${icon('records')}</span><div><b>현재 학교의 어법·어휘 범위를 준비 중이에요.</b><p>단원고와 선부고 시험범위부터 순서대로 추가하고 있어요.</p></div></section>
  `}`;
}

function middleLessonState(A) {
  const words = A.data.books.flatMap(book => book.words || []);
  const codes = [...new Set(words.map(word => String(word.range_code || '')).filter(Boolean))];
  if (!codes.length) return { words, codes, code: '', lessonWords: [], selected: [] };
  if (!codes.includes(String(A.middleRange || ''))) A.middleRange = codes[0];
  const code = String(A.middleRange);
  const lessonWords = words.filter(word => String(word.range_code) === code);
  const valid = new Set(lessonWords.map(word => word.id));
  A.middleWordIds = (A.middleWordIds || []).filter(id => valid.has(id));
  return { words, codes, code, lessonWords, selected: A.middleWordIds };
}
function practiceModePicker(A) {
  const primary = [
    ['write_meaning', '뜻 직접 쓰기', '영어를 보고 한국어 뜻을 직접 입력', '약 8초 / 문제'],
    ['spell', '영어 직접 쓰기', '뜻을 보고 영어 단어를 직접 입력', '약 12초 / 문제']
  ];
  const secondary = Object.entries(PRACTICE_TYPES).filter(([key]) => !['write_meaning', 'spell'].includes(key));
  return `<div class="primary-mode-grid">${primary.map(([key,label,help,timeText]) => `<button class="primary-mode-card ${A.mode === key ? 'selected' : ''}" data-mode="${key}" aria-pressed="${A.mode === key}"><span class="primary-mode-icon">${icon('records')}</span><div><b>${label}</b><small>${help}</small><em>${timeText}</em></div>${key === 'write_meaning' ? '<span class="pill blue">추천</span>' : ''}</button>`).join('')}</div>
  <div class="other-mode-label">기타 연습</div>
  <div class="mode-grid secondary-mode-grid">${secondary.map(([key,name]) => `<button class="mode-option ${A.mode === key ? 'selected' : ''}" data-mode="${key}" aria-pressed="${A.mode === key}">${icon(key === 'listen' ? 'sound' : key === 'mixed' ? 'sparkle' : ['scramble','initial','vowelblank'].includes(key) ? 'records' : 'practice')}${name}</button>`).join('')}</div>`;
}
function durationText(seconds) {
  const sec = Math.max(0, Number(seconds || 0));
  const min = Math.floor(sec / 60), rest = sec % 60;
  return min ? `${min}분 ${String(rest).padStart(2,'0')}초` : `${rest}초`;
}
function middleVocabPractice(A) {
  const { codes, code, lessonWords, selected } = middleLessonState(A);
  const selectedSet = new Set(selected);
  const lessonTabs = codes.map(range => `<button data-middle-lesson="${esc(range)}" class="${String(range) === code ? 'selected' : ''}">${esc(range)}과</button>`).join('');
  const rows = lessonWords.map((word, index) => `<label class="middle-word-row ${selectedSet.has(word.id) ? 'selected' : ''}"><input type="checkbox" data-middle-word="${esc(word.id)}" ${selectedSet.has(word.id) ? 'checked' : ''}><span class="middle-word-no">${index + 1}</span><span class="middle-word-en">${esc(word.word)}</span><span class="middle-word-ko">${esc(word.meaning)}</span></label>`).join('');
  const preset = [15,20,30].filter(n => lessonWords.length >= n).map(n => `<button data-middle-preset="${n}">앞 ${n}개</button>`).join('');
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill blue">MIDDLE VOCAB</span></div>
    <div class="page-heading"><h1>시험 볼 단어 고르기</h1><p>오늘 외운 만큼만 체크하면 돼요. 15개·20개·30개 모두 같은 방식으로 사용할 수 있어요.</p></div>
    <div class="step-label"><span>01</span>과 선택</div>
    <div class="middle-lesson-tabs">${lessonTabs || '<span class="tiny muted">등록된 단어가 없어요.</span>'}</div>
    <div class="step-label"><span>02</span>단어 선택</div>
    <div class="middle-word-tools"><div><button data-middle-preset="clear">선택 해제</button>${preset}<button data-middle-preset="all">전체</button></div><strong id="middle-selected-count">${selected.length}개 선택</strong></div>
    <section class="middle-word-list">${rows || empty('practice','이 과에 등록된 단어가 없어요','선생님이 단어 DB를 등록하면 여기에 순서대로 표시돼요.')}</section>
    <div class="step-label"><span>03</span>시험 방식</div>
    ${practiceModePicker(A)}
    <div class="practice-launch"><button class="btn primary full" data-action="start-practice" ${selected.length || A.data.active_practice ? '' : 'disabled'}>${A.data.active_practice ? '하던 연습 이어가기' : selected.length ? selected.length + '개 시험 시작하기' : '단어를 선택해주세요'} ${icon('arrow')}</button><p>체크한 단어만 원래 순서대로 한 번씩 나온 뒤, 틀린 단어를 다시 복습해요.</p></div>`;
}

function vocabPractice(A) {
  if (A.data.profile.division === 'middle') return middleVocabPractice(A);
  const count = selectedCount(A);
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill blue">VOCAB</span></div><div class="page-heading"><h1>단어 학습</h1><p>범위를 고르면, 약한 단어부터 익혀요.</p></div><div class="step-label"><span>01</span>내 학교</div>${schoolSwitch(A)}<div class="step-label"><span>02</span>연습할 범위</div>${rangePicker(A)}<div class="step-label"><span>03</span>시험 방식</div>${practiceModePicker(A)}<div class="practice-amount"><span class="tiny muted">한 번에 학습할 양</span><div class="practice-target-grid" role="group" aria-label="학습량 선택">${[10, 20, 30].map(n => `<button data-practice-target="${n}" class="${A.target === n ? 'selected' : ''}" aria-pressed="${A.target === n}">${n}<small>문제</small></button>`).join('')}<button data-practice-target="all" class="all ${A.target === 'all' ? 'selected' : ''}" aria-pressed="${A.target === 'all'}"><b>선택 범위 전체</b><small data-all-count>${count}개 단어 모두 보기</small></button></div></div><div class="practice-launch"><button class="btn primary full" data-action="start-practice" ${!count ? 'disabled' : ''}>${A.data.active_practice ? '하던 연습 이어가기' : '연습 시작하기'} ${icon('arrow')}</button><p>${A.target === 'all' ? '선택한 단어를 중복 없이 모두 본 뒤, 틀린 단어를 복습해요.' : '틀린 단어는 잠시 뒤 다시 나와요.'}</p></div>`;
}

function practice(A) {
  if (A.studyView === 'vocab') return vocabPractice(A);
  if (A.studyView === 'grammar') return grammarStudy(A);
  return studyHub(A);
}
export function examStatus(A, e) {
  const attempts = A.data.attempts.filter(a => a.exam_id === e.id);
  if (attempts.some(a => a.status === 'active')) return ['이어서 응시', 'blue', true];
  if (e.available_at > Date.now()) return ['시작 예정', '', false];
  if (e.due_at <= Date.now()) return ['마감', '', false];
  if (attempts.length >= e.max_attempts) return ['응시 완료', 'green', false];
  return ['응시 가능', 'blue', true];
}
function exam(A) {
  const list = [...A.data.exams].sort((a, b) => a.due_at - b.due_at);
  return `<div class="page-heading"><h1>실전시험</h1><p>연습한 실력, 차분하게 확인해요.</p></div><div class="exam-info">${icon('shield')}<p>선생님이 정한 범위로 응시해요.<br>시험 점수는 캐릭터 성장에 영향을 주지 않아요.</p></div><div class="exam-list">${list.length ? list.map(e => { const [status, cls, enabled] = examStatus(A, e); return `<article class="exam-card"><div class="row between"><span class="pill ${cls}">${status}</span><span class="tiny muted">${e.school}</span></div><h3>${esc(e.title)}</h3><p>${EXAM_TYPES[e.exam_type].label}</p><div class="exam-meta"><span>${e.question_count}문제</span><span>${Math.round(e.duration_sec / 60)}분</span><span>${e.passing_score}점 통과</span></div><p class="tiny">${e.available_at > Date.now() ? `${date(e.available_at)} 시작` : `${date(e.due_at)} 마감`}</p><button class="btn ${enabled ? 'primary' : ''} full" data-exam="${e.id}" style="margin-top:15px" ${enabled ? '' : 'disabled'}>${status === '이어서 응시' ? '이어서 응시하기' : enabled ? '시험 확인하기' : status}</button></article>`; }).join('') : empty('exam', '배정된 시험이 없어요', '새 시험이 열리면 여기에 표시돼요.')}</div>`;
}
function ranking(A) {
  const mode = A.rankMode || 'xp';
  const scope = A.rankScope || 'all';
  const period = A.rankPeriod || 'week';
  const metric = period === 'all' ? (mode === 'streak' ? 'all_streak' : `all_${mode}`) : mode;
  const all = [...A.data.ranking];
  const filtered = scope === 'all' ? all : all.filter(p => p.grade === scope);
  const items = filtered.sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0) || Number(b.xp || 0) - Number(a.xp || 0));
  const unit = mode === 'xp' ? 'P' : mode === 'streak' ? '일' : '문제';
  const myIndex = items.findIndex(p => p.is_me);
  const scopeLabel = scope === 'all' ? '전체' : scope;
  const info = A.data.ranking_period || {};
  const periodTitle = period === 'week' ? (info.label || '이번 주') : '통합 누적';
  const periodRange = period === 'week' ? (info.range || '월요일 ~ 일요일') : '첫 학습 기록부터 지금까지';
  const rankNo = item => Number(item[metric] || 0) > 0 ? items.findIndex(x => Number(x[metric] || 0) === Number(item[metric] || 0)) + 1 : '—';
  const note = period === 'week'
    ? '주간 기록은 한국시간 기준 매주 월요일 00:00에 새로 시작하며, 이전 기록은 통합에 계속 남아요.'
    : '통합은 기존 학습 기록 전체를 누적해서 보여줘요. 주간 리셋으로 삭제되는 기록은 없어요.';
  return `<div class="page-heading"><h1>SUMUS 랭킹</h1><p>중2 · 중3 · 고1이 함께 보는 학원 성장 순위</p></div>
    <div class="rank-intro"><div class="eyebrow">SUMUS ACADEMY · ${scopeLabel}</div><h2>같이 올라가면 더 재밌다.</h2><p>시험 점수가 아니라 실제로 쌓은 학습 기록으로 경쟁해요.</p></div>
    <div class="rank-scope" aria-label="학년별 랭킹">
      ${[['all','전체'],['중2','중2'],['중3','중3'],['고1','고1']].map(([k,label]) => `<button data-rank-scope="${k}" class="${scope === k ? 'selected' : ''}">${label}</button>`).join('')}
    </div>
    <div class="segment" aria-label="랭킹 기간"><button data-rank-period="week" class="${period === 'week' ? 'selected' : ''}">주간</button><button data-rank-period="all" class="${period === 'all' ? 'selected' : ''}">통합</button></div>
    <div style="margin:12px 0 14px;padding:13px 15px;border:1px solid #eaecf0;border-radius:15px;background:#f9fafb;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong style="font-size:14px">${esc(periodTitle)}</strong><span class="tiny muted">${esc(periodRange)}</span></div>
    <div class="segment rank-metric">${[['xp', '성장 포인트'], ['total', '연습량'], ['streak', '연속 학습']].map(([k, label]) => `<button data-rank-mode="${k}" class="${mode === k ? 'selected' : ''}">${label}</button>`).join('')}</div>
    ${myIndex >= 0 ? `<div class="my-rank-card"><span>내 ${scopeLabel} 순위</span><strong>${rankNo(items[myIndex])}<small>위</small></strong><p>${num(items[myIndex][metric] || 0)}${unit} · ${esc(periodTitle)}</p></div>` : ''}
    <div class="rank-list">${items.length ? items.map((p, index) => `<div class="rank-row ${p.is_me ? 'me' : ''} ${index < 3 && Number(p[metric] || 0) ? 'top-rank top-' + (index + 1) : ''}"><span class="rank-number">${rankNo(p)}</span>${avatar(p.avatar_key, { size: 'mini' })}<div class="grow"><strong>${esc(p.display_name)} ${p.is_me ? '<span class="pill blue">나</span>' : ''}</strong><small><span class="rank-grade">${esc(p.grade || '')}</span> · ${p.private ? '프로필 비공개' : `Lv.${p.level} · ${CHARACTERS[p.avatar_key]?.ko || '루미'}`}</small></div><span class="rank-score">${num(p[metric] || 0)}${unit}</span></div>`).join('') : empty('ranking', `${scopeLabel}에 아직 연습 기록이 없어요`, '학습을 시작하면 순위가 바로 생겨요.')}</div>
    <p class="quiet-note">${esc(note)}<br>전체 랭킹에는 중2·중3·고1 모든 활성 학생이 함께 포함돼요. 시험 성적은 랭킹에 포함하지 않아요.</p>`;
}
function records(A) {
  const tab = A.recordTab || 'all';
  const sessions = [...A.data.sessions].sort((a,b) => b.created_at - a.created_at);
  const attempts = A.data.attempts.filter(a => a.status === 'submitted').sort((a, b) => b.submitted_at - a.submitted_at);
  const combined = [
    ...sessions.map(item => ({ kind: 'practice', at: item.created_at, item })),
    ...attempts.map(item => ({ kind: 'exam', at: item.submitted_at, item }))
  ].sort((a,b) => b.at - a.at);
  const visible = tab === 'all' ? combined : combined.filter(row => row.kind === tab);
  const weekStart = A.data.ranking_period?.start || 0;
  const weeklyScores = combined.filter(row => row.at >= weekStart).map(row => row.kind === 'practice'
    ? (row.item.score ?? (row.item.total ? Math.round(row.item.correct / row.item.total * 100) : 0))
    : Number(row.item.score || 0));
  const allScores = combined.map(row => row.kind === 'practice'
    ? (row.item.score ?? (row.item.total ? Math.round(row.item.correct / row.item.total * 100) : 0))
    : Number(row.item.score || 0));
  const weeklyAvg = weeklyScores.length ? Math.round(weeklyScores.reduce((n,v)=>n+v,0)/weeklyScores.length) : 0;
  const best = allScores.length ? Math.max(...allScores) : 0;
  const totalQuestions = sessions.reduce((n,s)=>n+Number(s.total||0),0) + attempts.reduce((n,a)=>n+Number(a.total||0),0);
  const disputeState = sourceId => {
    const rows = (A.data.meaning_disputes || []).filter(item => item.source_id === sourceId);
    if (rows.some(item => item.status === 'pending')) return ' · 이의제기 심사중';
    if (rows.some(item => String(item.status || '').startsWith('approved'))) return ' · 재채점 완료';
    return '';
  };
  const rowHtml = row => {
    if (row.kind === 'practice') {
      const s = row.item, score = s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0);
      const ranges = (s.range_codes || []).map(code => `${esc(code)}과`).join(' · ') || '선택 범위';
      return `<button class="record-row full" style="width:100%;text-align:left" data-practice-record="${s.id}"><span class="square-icon">${icon('practice')}</span><div class="grow"><strong>${esc(ranges)} · ${esc(PRACTICE_TYPES[s.mode] || '연습')}</strong><p>${s.correct}/${s.total} 정답 · ${durationText(s.duration_sec)}${s.auto_submitted ? ' · 시간 종료' : ''}</p><p>${date(s.created_at)}</p></div><div class="result">${score}점<small>${disputeState(s.id).replace(/^ · /,'') || '연습 기록'}</small></div></button>`;
    }
    const a = row.item, e = A.data.exams.find(exam => exam.id === a.exam_id);
    return `<button class="record-row full" style="width:100%;text-align:left" data-result="${a.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><strong>${esc(e?.title || '실전시험')}</strong><p>${EXAM_TYPES[e?.exam_type]?.label || ''} · ${a.correct}/${a.total} 정답</p><p>${date(a.submitted_at)}</p></div><div class="result">${a.score === undefined ? '제출' : a.score + '점'}<small>${a.score === undefined ? '결과 비공개' : (disputeState(a.id).replace(/^ · /,'') || '시험 기록')}</small></div></button>`;
  };
  return `<div class="page-heading"><h1>내 기록</h1><p>언제, 어떤 범위를 봤고 몇 점이었는지 모두 남아요.</p></div>
    <div class="record-stats"><div><strong>${weeklyAvg}점</strong><span>이번 주 평균</span></div><div><strong>${combined.length}회</strong><span>총 기록</span></div><div><strong>${best}점</strong><span>최고 점수</span></div><div><strong>${num(totalQuestions)}</strong><span>누적 문제</span></div></div>
    <div class="segment"><button data-record-tab="all" class="${tab === 'all' ? 'selected' : ''}">전체</button><button data-record-tab="exam" class="${tab === 'exam' ? 'selected' : ''}">시험</button><button data-record-tab="practice" class="${tab === 'practice' ? 'selected' : ''}">연습</button></div>
    <div style="margin-top:18px">${visible.length ? visible.map(rowHtml).join('') : empty('records','아직 기록이 없어요','뜻쓰기나 영어쓰기를 마치면 점수와 시간이 여기에 저장돼요.')}</div>`;
}
function studio(A) {
  A.style ??= { avatar_key: A.data.profile.avatar_key || 'lumi', avatar_accessory: A.data.profile.avatar_accessory || 'none', avatar_frame: A.data.profile.avatar_frame || 'basic', avatar_title: A.data.profile.avatar_title || 'rookie' };
  const s = A.style, g = A.data.stats, tab = A.studioTab || 'character', c = CHARACTERS[s.avatar_key];
  const groups = { accessory: ACCESSORIES, frame: FRAMES, title: TITLES };
  let body = tab === 'character' ? `<div class="character-grid">${Object.entries(CHARACTERS).map(([key, c]) => `<button data-style="avatar_key" data-value="${key}" class="character-option ${s.avatar_key === key ? 'selected' : ''}" aria-pressed="${s.avatar_key === key}">${avatar(key)}<b>${c.name}</b><small>${c.type}</small></button>`).join('')}</div><p class="quiet-note">능력은 모두 같아요. 마음이 가는 친구를 골라요.</p>` : `<div class="reward-grid">${Object.entries(groups[tab]).map(([key, item]) => { const open = unlocked(item, g); return `<button data-style="avatar_${tab}" data-value="${key}" class="reward-item ${s['avatar_' + tab] === key ? 'selected' : ''}" ${open ? '' : 'disabled'}>${icon(open ? tab === 'title' ? 'records' : 'sparkle' : 'lock')}<b>${item.name}</b><small>${open ? '사용 가능' : item.level ? `Lv.${item.level}에 열려요` : item.combo ? '10연속 정답 달성' : '7일 연속 학습'}</small></button>`; }).join('')}</div>`;
  return `<div class="page-heading"><h1>${A.data.profile.avatar_key ? '내 캐릭터' : '함께 성장할 캐릭터'}</h1><p>${A.data.profile.avatar_key ? '연습으로 하나씩, 나답게.' : '처음의 선택. 언제든 바꿀 수 있어요.'}</p></div><div class="studio-preview">${avatar(s.avatar_key, { stage: g.stage, accessory: s.avatar_accessory, frame: s.avatar_frame })}<h2>${c.name} <span class="tiny muted">Lv.${g.level}</span></h2><p>${TITLES[s.avatar_title].name}</p></div><div class="segment">${[['character', '캐릭터'], ['accessory', '장식'], ['frame', '프레임'], ['title', '칭호']].map(([k, label]) => `<button data-studio-tab="${k}" class="${tab === k ? 'selected' : ''}">${label}</button>`).join('')}</div>${body}<button class="btn primary full" data-action="save-style">${A.data.profile.avatar_key ? '이 모습으로 저장' : '함께 시작하기'}</button><div class="section-title"><h2>다음 성장의 선물</h2></div><div class="roadmap">${[[3, '헤드셋'], [5, '실버 프레임'], [6, '글래스'], [9, '스타 핀'], [10, '블루 라인'], [15, '오로라'], [18, '크라운'], [20, '골드']].map(([lv, name]) => `<div><div class="milestone ${g.level >= lv ? 'done' : ''}">${icon(g.level >= lv ? 'check' : 'lock')}</div><b>${name}</b><small>Lv.${lv}</small></div>`).join('')}</div>`;
}
export function updateRangeSummary(A) {
  const { selected } = getRanges(A);
  const count = selectedCount(A);
  if ($('#scope-count')) $('#scope-count').textContent = `${selected.length}개 범위 · ${count}개 단어`;
  const all = $('[data-all-count]'); if (all) all.textContent = `${count}개 단어 모두 보기`;
  const start = $('[data-action="start-practice"]'); if (start) start.disabled = !selectedCount(A);
}
