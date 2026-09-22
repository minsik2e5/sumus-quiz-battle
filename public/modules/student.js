import { CHARACTERS, ACCESSORIES, FRAMES, TITLES, PRACTICE_TYPES, EXAM_TYPES, practiceDurationSec, unlocked, levelInfo, dayKey } from './core.js';
import { icon, esc, num, date, rangeLabel, recordRangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar } from './character.js';
import { DANWONGO_PASSAGES } from '../danwongo-grammar-data.js?v=2';
import { SEONBU_2025_PASSAGES, SEONBU_2026_PASSAGES } from '../seonbu-grammar-data.js?v=2';
import { GANGSEO_PASSAGES } from '../gangseo-grammar-data.js?v=1';
export const studentTabs = [['home', '홈', 'home'], ['practice', '학습', 'practice'], ['exam', '실전', 'exam'], ['ranking', '랭킹', 'ranking'], ['records', '기록', 'records']];
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
function scoredHistory(A) {
  const practices = (A.data.sessions || []).map(item => ({
    at: Number(item.created_at || 0),
    score: Number(item.score ?? (item.total ? Math.round(item.correct / item.total * 100) : 0)),
    visible: true,
    final: !(A.data.meaning_disputes || []).some(d => d.source_type === 'practice' && d.source_id === item.id && d.status === 'pending'),
    kind: 'practice', mode: item.mode, run_mode: item.run_mode || 'practice'
  }));
  const exams = (A.data.attempts || []).filter(item => item.status === 'submitted').map(item => {
    const exam = A.data.exams.find(e => e.id === item.exam_id);
    const visible = item.result_visibility === 'visible' && Number.isFinite(Number(item.score));
    return {
      at: Number(item.submitted_at || 0),
      score: visible ? Number(item.score) : null,
      visible,
      final: item.grading_status !== 'provisional',
      kind: 'exam',
      mode: exam?.exam_type || ''
    };
  });
  return [...practices, ...exams].sort((a,b) => a.at - b.at);
}
function achievementBadges(A) {
  const history = scoredHistory(A);
  const first100 = history.some(item => item.visible && item.final && item.score === 100);
  let streak90 = false, streak = 0;
  for (const item of history) { if (!item.visible || !item.final || item.score === null) { streak = 0; continue; } streak = item.score >= 90 ? streak + 1 : 0; if (streak >= 3) { streak90 = true; break; } }
  const english100 = history.some(item => item.visible && item.final && item.score === 100 && (item.mode === 'spell' || item.mode === 'write_en'));
  const badges = [
    { key: 'first100', label: '첫 100점', detail: '처음으로 100점을 달성했어요', earned: first100, icon: 'sparkle' },
    { key: 'streak90', label: '3회 연속 90점+', detail: '세 번 연속 90점 이상', earned: streak90, icon: 'flame' },
    { key: 'english100', label: '영어쓰기 100점', detail: '영어 직접 쓰기 만점', earned: english100, icon: 'records' }
  ];
  const mastered = Object.values(A.data.word_mastery?.ranges || {}).filter(state => ['master','perfect'].includes(state.status)).sort((a,b) => String(a.range_code).localeCompare(String(b.range_code), 'ko', { numeric: true }));
  for (const state of mastered) badges.push({ key: 'master-' + state.range_code, label: `${A.data.profile.division === 'middle' ? state.range_code + '과' : rangeLabel(A.school, state.range_code)} MASTER`, detail: state.status === 'perfect' ? '정답률 100% 완전 정복' : '최근 성취 95% 이상', earned: true, icon: 'check' });
  return badges;
}
function achievementSection(A, full = false) {
  const badges = achievementBadges(A);
  const visible = full ? badges : [...badges.filter(item => item.earned), ...badges.filter(item => !item.earned)].slice(0, 4);
  const earned = badges.filter(item => item.earned).length;
  return `<div class="section-title"><h2>성취 배지</h2>${full ? `<span class="tiny muted">${earned}개 달성</span>` : '<button class="text-button" data-go="records">전체 보기 ' + icon('chevron') + '</button>'}</div><div class="achievement-grid">${visible.map(item => `<div class="achievement-badge ${item.earned ? 'earned' : 'locked'}"><span>${icon(item.earned ? item.icon : 'lock')}</span><div><b>${esc(item.label)}</b><small>${esc(item.earned ? item.detail : '아직 도전 중')}</small></div></div>`).join('')}</div>`;
}
function recentRecordCard(A) {
  const sessions = (A.data.sessions || []).map(item => ({ kind: 'practice', at: item.created_at, item }));
  const attempts = (A.data.attempts || []).filter(item => item.status === 'submitted').map(item => ({ kind: 'exam', at: item.submitted_at, item }));
  const rows = [...sessions, ...attempts].sort((a,b) => b.at - a.at).slice(0,3);
  if (!rows.length) return '';
  const line = row => {
    if (row.kind === 'practice') {
      const s = row.item, score = s.score ?? (s.total ? Math.round(s.correct / s.total * 100) : 0);
      const ranges = (s.range_codes || []).map(code => esc(recordRangeLabel(s, code))).join(' · ') || '선택 범위';
      return `<button class="exam-row" data-practice-record="${s.id}"><span class="square-icon">${icon('practice')}</span><div class="grow"><h3>${esc(ranges)} · ${esc(PRACTICE_TYPES[s.mode] || '연습')} · ${s.run_mode === 'test' ? '실전' : '연습'}</h3><p>${s.correct}/${s.total} 정답 · ${durationText(s.duration_sec)} · ${date(s.created_at)}</p></div><strong>${score}점</strong></button>`;
    }
    const a = row.item, e = A.data.exams.find(exam => exam.id === a.exam_id);
    return `<button class="exam-row" data-result="${a.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><h3>${esc(e?.title || '실전시험')}</h3><p>${EXAM_TYPES[e?.exam_type]?.label || ''} · ${date(a.submitted_at)}</p></div><strong>${a.result_visibility === 'visible' && a.score !== undefined ? a.score + '점' : '공개 대기'}</strong></button>`;
  };
  return `<div class="section-title"><h2>최근 기록</h2><button class="text-button" data-go="records">전체 기록 보기 ${icon('chevron')}</button></div>${rows.map(line).join('')}`;
}
function homePrimaryAction(A) {
  const activePractice = A.data.active_practice_summary || null;
  if (activePractice) {
    const ranges = (activePractice.range_codes || []).map(code => recordRangeLabel({ division: activePractice.division, school: activePractice.school }, code)).join(' · ') || '선택 범위';
    return {
      kicker: activePractice.run_mode === 'test' ? '진행 중인 실전' : '진행 중인 연습',
      title: '이어서 마무리해요',
      detail: `${esc(ranges)} · ${esc(PRACTICE_TYPES[activePractice.mode] || '단어 학습')} · ${Number(activePractice.score_total || 0)}/${activePractice.target}`,
      meta: activePractice.deadline ? `${date(activePractice.deadline)}까지` : '진행 중',
      cta: '이어서 풀기',
      attrs: 'data-quick-practice="true"'
    };
  }

  const unsentTest = [...(A.data.sessions || [])]
    .filter(item => item.run_mode === 'test' && !item.shared_to_teacher_at)
    .sort((a,b) => b.created_at - a.created_at)[0];
  if (unsentTest) {
    const ranges = (unsentTest.range_codes || []).map(code => recordRangeLabel(unsentTest, code)).join(' · ') || '최근 범위';
    return {
      kicker: '실전 결과 미전송',
      title: `${unsentTest.score ?? 0}점 결과를 확인해요`,
      detail: `${esc(ranges)} · ${esc(PRACTICE_TYPES[unsentTest.mode] || '쓰기')}`,
      meta: '원하면 선생님께 결과를 보낼 수 있어요.',
      cta: '결과 확인하기',
      attrs: `data-practice-record="${unsentTest.id}"`
    };
  }

  const recentReview = [...(A.data.sessions || [])]
    .sort((a,b) => b.created_at - a.created_at)
    .find(item => Number(item.wrong_count ?? (item.wrong_details || []).filter(detail => !detail.regraded).length) > 0);
  if (recentReview) {
    const wrong = Number(recentReview.wrong_count ?? (recentReview.wrong_details || []).filter(detail => !detail.regraded).length);
    const ranges = (recentReview.range_codes || []).map(code => recordRangeLabel(recentReview, code)).join(' · ') || '최근 범위';
    return {
      kicker: '최근 오답 복습',
      title: `${ranges} 오답을 정리해요`,
      detail: `${esc(PRACTICE_TYPES[recentReview.mode] || '단어 학습')} · 지난 기록 ${recentReview.score ?? 0}점 · 오답 ${wrong}개`,
      meta: date(recentReview.created_at),
      cta: `오답 ${wrong}개 복습`,
      attrs: `data-review-practice="${recentReview.id}"`
    };
  }

  const recent = [...(A.data.sessions || [])].sort((a,b) => b.created_at - a.created_at)[0];
  if (recent) {
    const ranges = (recent.range_codes || []).map(code => recordRangeLabel(recent, code)).join(' · ') || '최근 범위';
    return {
      kicker: '최근 학습',
      title: `${ranges}를 다시 외워볼까요?`,
      detail: `${esc(PRACTICE_TYPES[recent.mode] || '단어 학습')} · ${recent.score ?? 0}점`,
      meta: date(recent.created_at),
      cta: '단어 외우기',
      attrs: 'data-study="vocab"'
    };
  }

  return {
    kicker: '오늘의 시작',
    title: '먼저 단어를 외워봐요',
    detail: '뜻을 가린 목록으로 외운 뒤, 문제 연습과 실전으로 확인할 수 있어요.',
    meta: '실전 결과는 원하는 것만 선생님께 보냅니다.',
    cta: '단어 외우기 시작',
    attrs: 'data-study="vocab"'
  };
}
function compactGrowth(A) {
  const p = A.data.profile, g = A.data.stats, badges = achievementBadges(A);
  const earned = badges.filter(item => item.earned);
  const latest = earned[0];
  return `<section class="home-growth-compact"><div class="home-growth-avatar">${avatar(p.avatar_key || 'lumi', { size: 'mini', accessory: p.avatar_accessory, frame: p.avatar_frame })}</div><div class="grow"><span class="tiny muted">내 성장</span><b>Lv.${g.level} · ${num(g.current)}P</b><small>${latest ? '대표 성취 · ' + esc(latest.label) : '첫 성취를 준비 중이에요.'}</small></div><button class="text-button" data-go="records">성취 ${earned.length}개 ${icon('chevron')}</button></section>`;
}
function homeSchedule(A) {
  const rows = [];
  const latestTests = [...(A.data.sessions || [])].filter(item => item.run_mode === 'test').sort((a,b) => b.created_at - a.created_at).slice(0,2);
  for (const item of latestTests) {
    const ranges = (item.range_codes || []).map(code => recordRangeLabel(item, code)).join(' · ') || '선택 범위';
    rows.push(`<button class="home-schedule-row" data-practice-record="${item.id}"><span class="home-schedule-icon">${icon('exam')}</span><div class="grow"><b>${esc(ranges)} · ${item.score ?? 0}점</b><small>${esc(PRACTICE_TYPES[item.mode] || '쓰기')} · ${date(item.created_at)}</small></div><span class="home-schedule-state">${item.shared_to_teacher_at ? '전송 완료' : '내 실전'}</span>${icon('chevron')}</button>`);
  }
  if (!A.data.active_practice && A.data.daily_quest?.target > 0) {
    rows.push(`<button class="home-schedule-row" data-quick-practice="true"><span class="home-schedule-icon">${icon('practice')}</span><div class="grow"><b>추천 복습 ${A.data.daily_quest.target}개</b><small>오답·복습·새 단어를 섞어서 연습</small></div><span class="home-schedule-state">추천</span>${icon('chevron')}</button>`);
  }
  if (!rows.length) return '<p class="home-empty-line">오늘은 단어 외우기부터 자유롭게 시작하면 돼요.</p>';
  return rows.slice(0,3).join('');
}
function homeRecommendations(A) {
  const rows = [];
  if (!A.data.active_practice && A.data.daily_quest?.target > 0) {
    const mix = A.data.daily_quest.mix || {};
    rows.push(`<button class="home-recommend-row" data-quick-practice="true"><span>${icon('practice')}</span><div class="grow"><b>추천 복습 ${A.data.daily_quest.target}개</b><small>오답 ${mix.wrong || 0} · 복습 ${mix.review || 0} · 새 단어 ${mix.new || 0}</small></div>${icon('chevron')}</button>`);
  }
  const school = A.data.profile.school || A.school || '';
  const passages = grammarPassagesForSchool(school);
  if (passages.length) {
    const target = passages.find(p => !savedGrammarProgress(A, p)?.mastered) || passages[0];
    rows.push(`<button class="home-recommend-row" data-action="grammar-choice" data-grammar-id="${esc(target.id)}"><span>${icon('records')}</span><div class="grow"><b>어법·어휘 ${esc(target.number)}번</b><small>${esc(grammarExamLabel(target))} · ${target.sentences.length}문장</small></div>${icon('chevron')}</button>`);
  }
  return rows.length ? `<div class="section-title"><h2>추천 학습</h2></div><div class="home-recommend-list">${rows.join('')}</div>` : '';
}
function home(A) {
  const p = A.data.profile;
  const action = homePrimaryAction(A);
  return `<div class="home-context"><div><span>SUMUS VOCA</span><b>${esc(p.school || A.school || '학교 미설정')} · ${esc(p.class_name || '')}</b></div>${A.data.stats.streak ? `<span class="streak-badge">${icon('flame')}${A.data.stats.streak}일째</span>` : ''}</div>
    <section class="home-focus-card">
      <span class="home-focus-kicker">${action.kicker}</span>
      <h1>${action.title}</h1>
      <p>${action.detail}</p>
      <small>${action.meta}</small>
      <button class="btn primary full home-focus-cta" ${action.attrs}>${action.cta} ${icon('arrow')}</button>
    </section>
    <div class="section-title home-section-head"><h2>오늘 학습</h2><button class="text-button" data-go="exam">내 실전 ${icon('chevron')}</button></div>
    <div class="home-schedule-list">${homeSchedule(A, action)}</div>
    ${recentRecordCard(A)}
    ${homeRecommendations(A)}
    ${compactGrowth(A)}`;
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
function practiceModePicker(A, { selfTest = false } = {}) {
  const primary = [
    ['write_meaning', '뜻 직접 쓰기', '영어를 보고 한국어 뜻을 직접 입력', '약 8초 / 문제'],
    ['spell', '영어 직접 쓰기', '뜻을 보고 영어 단어를 직접 입력', '약 12초 / 문제']
  ];
  const secondary = Object.entries(PRACTICE_TYPES).filter(([key]) => !['write_meaning', 'spell'].includes(key));
  const otherSelected = !['write_meaning','spell'].includes(A.mode);
  return `<div class="primary-mode-grid">${primary.map(([key,label,help,timeText]) => `<button class="primary-mode-card ${A.mode === key ? 'selected' : ''}" data-mode="${key}" aria-pressed="${A.mode === key}"><span class="primary-mode-icon">${icon('records')}</span><div><b>${label}</b><small>${help}</small><em>${timeText}</em></div>${key === 'write_meaning' ? '<span class="pill blue">추천</span>' : ''}</button>`).join('')}</div>
  ${selfTest ? '<div class="setup-inline-note">' + icon('shield') + ' 실전은 뜻쓰기·영어쓰기만 사용하고, 정답은 끝난 뒤 한꺼번에 공개해요.</div>' : `<button class="other-practice-toggle" data-other-practice="toggle" aria-expanded="${A.otherPracticeOpen || otherSelected ? 'true' : 'false'}"><span>기타 연습</span><small>${otherSelected ? esc(PRACTICE_TYPES[A.mode]) + ' 선택됨' : '객관식 · 듣기 · 철자 보조'}</small>${icon('chevron')}</button>
  ${A.otherPracticeOpen || otherSelected ? `<div class="mode-grid secondary-mode-grid">${secondary.map(([key,name]) => `<button class="mode-option ${A.mode === key ? 'selected' : ''}" data-mode="${key}" aria-pressed="${A.mode === key}">${icon(key === 'listen' ? 'sound' : key === 'mixed' ? 'sparkle' : ['scramble','initial','vowelblank'].includes(key) ? 'records' : 'practice')}${name}</button>`).join('')}</div>` : ''}`}`;
}
function memorizationWords(A) {
  if (A.data.profile.division === 'middle') return middleLessonState(A).lessonWords;
  const { words, selected } = getRanges(A);
  return words.filter(word => selected.includes(word.range_code));
}
function memorizationPanel(A) {
  const middle = A.data.profile.division === 'middle';
  const words = memorizationWords(A);
  const stars = new Set(A.memStars || []);
  const revealed = new Set(A.memRevealed || []);
  const starredOnly = A.memorizeFilter === 'starred';
  const visible = starredOnly ? words.filter(word => stars.has(word.id)) : words;
  const allShown = A.memorizeShowAll === true;
  const rangeUi = middle
    ? (() => {
        const state = middleLessonState(A);
        return `<div class="middle-lesson-tabs setup-choice-row">${state.codes.map(range => { const count = state.words.filter(word => String(word.range_code) === String(range)).length; return `<button data-middle-lesson="${esc(range)}" class="${String(range) === state.code ? 'selected' : ''}">${esc(range)}과 <small>${count}개</small></button>`; }).join('')}</div>`;
      })()
    : schoolSwitch(A) + rangePicker(A);
  const starredInScope = words.filter(word => stars.has(word.id));
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill green">MEMORIZE</span></div>
    <div class="page-heading memorize-heading"><h1>단어 외우기</h1><p>뜻을 가린 채 단어를 보고, 기억이 안 나면 그 자리에서 눌러 확인해요.</p></div>
    <section class="setup-section"><div class="step-label"><span>01</span>외울 범위</div>${rangeUi}</section>
    <section class="memorize-shell">
      <div class="memorize-toolbar">
        <div class="segment compact"><button data-memorize-filter="all" class="${!starredOnly ? 'selected' : ''}">전체 ${words.length}</button><button data-memorize-filter="starred" class="${starredOnly ? 'selected' : ''}">★ 어려운 단어 ${starredInScope.length}</button></div>
        <button class="text-button" data-memorize-reveal-all="${allShown ? 'hide' : 'show'}">${allShown ? '뜻 모두 가리기' : '뜻 모두 보기'}</button>
      </div>
      <div class="memorize-list">${visible.length ? visible.map((word,index) => {
        const show = allShown || revealed.has(word.id);
        const star = stars.has(word.id);
        return `<div class="memorize-row ${show ? 'revealed' : ''} ${star ? 'starred' : ''}">
          <button class="memorize-star" data-memorize-star="${esc(word.id)}" aria-label="${star ? '어려운 단어 해제' : '어려운 단어 표시'}">${star ? '★' : '☆'}</button>
          <button class="memorize-word" data-memorize-word="${esc(word.id)}"><span class="memorize-no">${index + 1}</span><strong>${esc(word.word)}</strong><small>${show ? '뜻 다시 가리기' : '눌러서 뜻 확인'}</small></button>
          ${show ? `<div class="memorize-meaning"><span>뜻</span><b>${esc(word.meaning)}</b></div>` : ''}
        </div>`;
      }).join('') : '<div class="memorize-empty">표시할 단어가 없어요. 별표 필터를 해제하거나 범위를 선택해주세요.</div>'}</div>
      <div class="memorize-actions">
        ${starredInScope.length ? `<button class="btn full" data-memorize-practice="starred">★ 어려운 단어 ${starredInScope.length}개 쓰기 연습</button>` : ''}
        <button class="btn primary full" data-vocab-panel="quiz">문제로 확인하기 ${icon('arrow')}</button>
      </div>
    </section>`;
}

function practiceSetupSummary(A, availableCount) {
  const count = Math.max(0, Number(availableCount || 0));
  const target = A.data.profile.division === 'middle'
    ? count
    : A.target === 'all' ? count : Math.min(count, Number(A.target || 0));
  const duration = target ? practiceDurationSec(A.mode, target) : 0;
  const mode = PRACTICE_TYPES[A.mode] || '학습';
  const runMode = ['write_meaning','spell'].includes(A.mode) && A.practiceRunMode === 'test' ? '실전 모드' : '연습 모드';
  return { target, duration, mode, runMode, text: target ? `${target}단어 · ${mode} · ${runMode} · ${durationText(duration)}` : '학습할 단어를 선택해주세요.' };
}
function durationText(seconds) {
  const sec = Math.max(0, Number(seconds || 0));
  const min = Math.floor(sec / 60), rest = sec % 60;
  return min ? `${min}분 ${String(rest).padStart(2,'0')}초` : `${rest}초`;
}
function middleVocabQuiz(A) {
  const { words, codes, code, lessonWords, selected } = middleLessonState(A);
  const selectedSet = new Set(selected);
  const lessonTabs = codes.map(range => { const count = words.filter(word => String(word.range_code) === String(range)).length; return `<button data-middle-lesson="${esc(range)}" class="${String(range) === code ? 'selected' : ''}">${esc(range)}과 <small>${count}개</small></button>`; }).join('');
  const rows = lessonWords.map((word, index) => `<label class="middle-word-row ${selectedSet.has(word.id) ? 'selected' : ''}"><input type="checkbox" data-middle-word="${esc(word.id)}" ${selectedSet.has(word.id) ? 'checked' : ''}><span class="middle-word-no">${index + 1}</span><span class="middle-word-en">${esc(word.word)}</span><span class="middle-word-ko">${esc(word.meaning)}</span></label>`).join('');
  const preset = [15,20,30].filter(n => lessonWords.length >= n).map(n => `<button data-middle-preset="${n}" class="${selected.length === n ? 'selected' : ''}">앞 ${n}개</button>`).join('');
  const summary = practiceSetupSummary(A, selected.length);
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill blue">VOCAB</span></div>
    <div class="page-heading setup-heading"><h1>단어 학습 준비</h1><p>${esc(A.data.profile.school || A.school)} · ${esc(A.data.profile.class_name)} · YBM(박준언)</p></div>
    <section class="setup-section">
      <div class="step-label"><span>01</span>범위</div>
      <div class="middle-lesson-tabs setup-choice-row">${lessonTabs || '<span class="tiny muted">등록된 단어가 없어요.</span>'}</div>
    </section>
    <section class="setup-section">
      <div class="step-label"><span>02</span>학습량</div>
      <div class="middle-preset-grid"><button data-middle-preset="clear" class="${!selected.length ? 'selected' : ''}">선택 안 함</button>${preset}<button data-middle-preset="all" class="${selected.length === lessonWords.length && lessonWords.length ? 'selected' : ''}">전체 ${lessonWords.length}개</button></div>
      <button class="direct-word-toggle" data-middle-words-toggle="true" aria-expanded="${A.middleWordsOpen ? 'true' : 'false'}"><span><b>직접 선택</b><small>원본 순서에서 필요한 단어만 고르기</small></span><strong>${selected.length}개 선택</strong>${icon('chevron')}</button>
      ${A.middleWordsOpen ? `<div class="middle-word-tools"><div><button data-middle-preset="clear">선택 해제</button><button data-middle-preset="all">전체</button></div><strong id="middle-selected-count">${selected.length}개 선택</strong></div><section class="middle-word-list">${rows || empty('practice','이 과에 등록된 단어가 없어요','선생님이 단어 DB를 등록하면 여기에 표시돼요.')}</section>` : ''}
    </section>
    <section class="setup-section">
      <div class="step-label"><span>03</span>쓰기 방식</div>
      ${practiceModePicker(A)}
    </section>
    <aside class="setup-start-summary">
      <div><span>시작 요약</span><strong id="setup-summary-text">${esc(code ? code + '과 · ' + summary.text : summary.text)}</strong><small>${A.practiceRunMode === 'test' && ['write_meaning','spell'].includes(A.mode) ? '정답은 종료 후 공개되고 시간 종료 시 자동 제출돼요.' : '연습에서는 정답 확인 후 틀린 단어를 다시 볼 수 있어요.'}</small></div>
      <button class="btn primary full" data-action="start-practice" ${selected.length || A.data.active_practice ? '' : 'disabled'}>${A.data.active_practice ? '진행 중인 학습 확인' : A.practiceRunMode === 'test' && ['write_meaning','spell'].includes(A.mode) ? '실전 모드 확인' : '연습 시작하기'} ${icon('arrow')}</button>
    </aside>`;
}
function vocabQuiz(A) {
  if (A.data.profile.division === 'middle') return middleVocabQuiz(A);
  const count = selectedCount(A);
  const summary = practiceSetupSummary(A, count);
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill blue">VOCAB</span></div>
    <div class="page-heading setup-heading"><h1>단어 학습 준비</h1><p>${esc(A.data.profile.school || A.school)} · ${esc(A.data.profile.class_name)} · 시험범위 단어</p></div>
    <section class="setup-section"><div class="step-label"><span>01</span>범위</div>${schoolSwitch(A)}${rangePicker(A)}</section>
    <section class="setup-section"><div class="step-label"><span>02</span>학습량</div><div class="practice-target-grid" role="group" aria-label="학습량 선택">${[10,20,30].map(n => `<button data-practice-target="${n}" class="${A.target === n ? 'selected' : ''}" aria-pressed="${A.target === n}">${n}<small>문제</small></button>`).join('')}<button data-practice-target="all" class="all ${A.target === 'all' ? 'selected' : ''}" aria-pressed="${A.target === 'all'}"><b>선택 범위 전체</b><small>${count}개 단어</small></button></div></section>
    <section class="setup-section"><div class="step-label"><span>03</span>쓰기 방식</div>${practiceModePicker(A)}</section>
    <aside class="setup-start-summary"><div><span>시작 요약</span><strong id="setup-summary-text">${esc(summary.text)}</strong><small>${A.practiceRunMode === 'test' && ['write_meaning','spell'].includes(A.mode) ? '정답은 종료 후 공개되고 시간 종료 시 자동 제출돼요.' : '연습에서는 정답 확인 후 틀린 단어를 다시 볼 수 있어요.'}</small></div><button class="btn primary full" data-action="start-practice" ${!count && !A.data.active_practice ? 'disabled' : ''}>${A.data.active_practice ? '진행 중인 학습 확인' : A.practiceRunMode === 'test' && ['write_meaning','spell'].includes(A.mode) ? '실전 모드 확인' : '연습 시작하기'} ${icon('arrow')}</button></aside>`;
}
function vocabPractice(A) {
  const panel = A.vocabPanel || 'memorize';
  if (panel === 'memorize') return memorizationPanel(A);
  A.practiceRunMode = 'practice';
  return `<div class="vocab-panel-switch segment"><button data-vocab-panel="memorize">암기하기</button><button data-vocab-panel="quiz" class="selected">문제 연습</button></div>${vocabQuiz(A)}`;
}

function practice(A) {
  if (A.studyView === 'vocab') return vocabPractice(A);
  if (A.studyView === 'grammar') return grammarStudy(A);
  return studyHub(A);
}
function selfTestTargetGrid(A, count) {
  return `<div class="practice-target-grid" role="group" aria-label="실전 문항 수 선택">${[10,20,30].filter(n => count >= n).map(n => `<button data-practice-target="${n}" class="${A.target === n ? 'selected' : ''}">${n}<small>문제</small></button>`).join('')}<button data-practice-target="all" class="all ${A.target === 'all' ? 'selected' : ''}"><b>선택 범위 전체</b><small>${count}개 단어</small></button></div>`;
}
function exam(A) {
  A.practiceRunMode = 'test';
  if (!['write_meaning','spell'].includes(A.mode)) A.mode = 'write_meaning';
  const middle = A.data.profile.division === 'middle';
  let scopeUi = '', count = 0, scopeLabel = '';
  if (middle) {
    const state = middleLessonState(A);
    count = state.lessonWords.length;
    scopeLabel = state.code ? state.code + '과' : '범위 미선택';
    scopeUi = `<div class="middle-lesson-tabs setup-choice-row">${state.codes.map(range => { const n = state.words.filter(word => String(word.range_code) === String(range)).length; return `<button data-middle-lesson="${esc(range)}" class="${String(range) === state.code ? 'selected' : ''}">${esc(range)}과 <small>${n}개</small></button>`; }).join('')}</div>`;
  } else {
    const state = getRanges(A);
    count = state.words.filter(word => state.selected.includes(word.range_code)).length;
    scopeLabel = state.selected.map(code => recordRangeLabel({ division: 'high', school: A.school }, code)).join(' · ') || '범위 미선택';
    scopeUi = schoolSwitch(A) + rangePicker(A);
  }
  const target = A.target === 'all' ? count : Math.min(count, Number(A.target || 20));
  const duration = target ? practiceDurationSec(A.mode, target) : 0;
  const sentCount = (A.data.sessions || []).filter(item => item.run_mode === 'test' && item.shared_to_teacher_at).length;
  return `<div class="page-heading self-test-heading"><span class="eyebrow">SELF TEST</span><h1>내가 직접 보는 실전</h1><p>선생님 배정 없이 범위와 유형을 직접 고르고, 끝난 결과만 선생님께 보낼 수 있어요.</p></div>
    <div class="self-test-rule-strip"><span>${icon('shield')} 중간 정답 공개 없음</span><span>${icon('clock')} 전체 제한시간</span><span>${icon('records')} 결과 전송 선택</span></div>
    <section class="setup-section"><div class="step-label"><span>01</span>시험 범위</div>${scopeUi}</section>
    <section class="setup-section"><div class="step-label"><span>02</span>문항 수</div>${selfTestTargetGrid(A, count)}</section>
    <section class="setup-section"><div class="step-label"><span>03</span>시험 방식</div>${practiceModePicker(A, { selfTest: true })}</section>
    <aside class="setup-start-summary self-test-summary"><div><span>실전 시작 전 확인</span><strong>${esc(scopeLabel)} · ${target || 0}문제 · ${esc(PRACTICE_TYPES[A.mode] || '뜻쓰기')}</strong><small>전체 제한시간 ${durationText(duration)} · 완료 후 점수 확인 · 지금까지 선생님께 보낸 실전 ${sentCount}회</small></div><button class="btn primary full" data-action="start-self-test" ${count ? '' : 'disabled'}>실전 시작하기 ${icon('arrow')}</button></aside>`;
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
  const visible = tab === 'all' ? combined : tab === 'selftest' ? combined.filter(row => row.kind === 'practice' && row.item.run_mode === 'test') : tab === 'practice' ? combined.filter(row => row.kind === 'practice' && row.item.run_mode !== 'test') : combined.filter(row => row.kind === tab);
  const weekStart = A.data.ranking_period?.start || 0;
  const numericScore = row => {
    if (row.kind === 'practice') return Number(row.item.score ?? (row.item.total ? Math.round(row.item.correct / row.item.total * 100) : 0));
    return row.item.result_visibility === 'visible' && Number.isFinite(Number(row.item.score)) ? Number(row.item.score) : null;
  };
  const weeklyScores = combined.filter(row => row.at >= weekStart).map(numericScore).filter(Number.isFinite);
  const allScores = combined.map(numericScore).filter(Number.isFinite);
  const weeklyAvg = weeklyScores.length ? Math.round(weeklyScores.reduce((n,v)=>n+v,0)/weeklyScores.length) : null;
  const best = allScores.length ? Math.max(...allScores) : null;
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
      const ranges = (s.range_codes || []).map(code => esc(recordRangeLabel(s, code))).join(' · ') || '선택 범위';
      return `<button class="record-row full" style="width:100%;text-align:left" data-practice-record="${s.id}"><span class="square-icon">${icon('practice')}</span><div class="grow"><strong>${esc(ranges)} · ${esc(PRACTICE_TYPES[s.mode] || '연습')} · ${s.run_mode === 'test' ? '실전' : '연습'}</strong><p>${s.correct}/${s.total} 정답 · ${durationText(s.duration_sec)}${s.auto_submitted ? ' · 시간 종료' : ''}</p><p>${date(s.created_at)}</p></div><div class="result">${score}점<small>${disputeState(s.id).replace(/^ · /,'') || (s.run_mode === 'test' ? (s.shared_to_teacher_at ? '선생님 전송 완료' : '실전 · 미전송') : '연습 기록')}</small></div></button>`;
    }
    const a = row.item, e = A.data.exams.find(exam => exam.id === a.exam_id);
    return `<button class="record-row full" style="width:100%;text-align:left" data-result="${a.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><strong>${esc(e?.title || '실전시험')}</strong><p>${EXAM_TYPES[e?.exam_type]?.label || ''}${a.result_visibility === 'visible' && a.correct !== undefined ? ' · ' + a.correct + '/' + a.total + ' 정답' : ' · 제출 완료'}</p><p>${date(a.submitted_at)}</p></div><div class="result">${a.result_visibility === 'visible' && a.score !== undefined ? a.score + '점' : '공개 대기'}<small>${a.result_visibility === 'visible' ? (disputeState(a.id).replace(/^ · /,'') || (a.grading_status === 'provisional' ? '임시 점수' : '시험 기록')) : '선생님 공개 대기'}</small></div></button>`;
  };
  return `<div class="page-heading"><h1>내 기록</h1><p>언제, 어떤 범위를 봤고 몇 점이었는지 모두 남아요.</p></div>
    <div class="record-stats"><div><strong>${weeklyAvg === null ? '—' : weeklyAvg + '점'}</strong><span>이번 주 평균 · 공개 ${weeklyScores.length}회</span></div><div><strong>${combined.length}회</strong><span>총 기록</span></div><div><strong>${best === null ? '—' : best + '점'}</strong><span>최고 공개 점수</span></div><div><strong>${num(totalQuestions)}</strong><span>누적 문제</span></div></div>
    ${achievementSection(A, true)}
    <div class="segment"><button data-record-tab="all" class="${tab === 'all' ? 'selected' : ''}">전체</button><button data-record-tab="selftest" class="${tab === 'selftest' ? 'selected' : ''}">실전</button><button data-record-tab="practice" class="${tab === 'practice' ? 'selected' : ''}">연습</button></div>
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
