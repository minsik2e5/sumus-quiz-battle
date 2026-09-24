import { CHARACTERS, ACCESSORIES, FRAMES, TITLES, PRACTICE_TYPES, EXAM_TYPES, PRACTICE_SECONDS_PER_QUESTION, unlocked, levelInfo, dayKey } from './core.js';
import { icon, esc, num, date, rangeLabel, recordRangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar } from './character.js';
import { DANWONGO_PASSAGES } from '../danwongo-grammar-data.js?v=2';
import { SEONBU_2025_PASSAGES, SEONBU_2026_PASSAGES } from '../seonbu-grammar-data.js?v=2';
import { GANGSEO_PASSAGES } from '../gangseo-grammar-data.js?v=1';
import { MIDDLE_DONGA_YOON_PASSAGES, MIDDLE_DONGA_YOON_BY_LESSON } from '../middle-donga-yoon-grammar-data.js?v=1';
export const studentTabs = [['home', '홈', 'home'], ['practice', '학습', 'practice'], ['exam', '시험', 'exam'], ['ranking', '랭킹', 'ranking'], ['records', '기록', 'records']];
export function shell(A, content) {
  const p = A.data.profile;
  return `<div class="student-app">${p.preview_owner_id ? '<button class="btn secondary" data-action="exit-student-preview" style="position:fixed;top:12px;right:12px;z-index:1000">← 교사 화면으로</button>' : ''}<main class="student-main"><header class="app-header"><div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><button class="profile-dot" data-action="account" aria-label="내 계정">${esc(p.display_name.slice(0, 1))}</button></header>${content}</main><nav class="bottom-nav" aria-label="주 메뉴">${studentTabs.map(([id, name, i]) => `<button data-go="${id}" class="${A.tab === id ? 'active' : ''}" ${A.tab === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${name}</span></button>`).join('')}</nav></div>`;
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
        <span><b>+${num(g.today_xp || 0)} XP</b><small>오늘 XP</small></span>
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
function grammarPassagesForSchool(school, division = 'high') {
  if (division === 'middle') return MIDDLE_DONGA_YOON_PASSAGES;
  if (school === '단원고') return DANWONGO_PASSAGES;
  if (school === '선부고') return [...SEONBU_2026_PASSAGES, ...SEONBU_2025_PASSAGES];
  if (school === '강서고') return GANGSEO_PASSAGES;
  return [];
}
function grammarExamLabel(passage) {
  return passage.id.startsWith('middle-dong-a-yoon') ? '중3 동아(윤정미) · 본문 Part 4'
    : passage.id.startsWith('2026-06-busan') ? '2026년 6월 부산교육청'
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
  const passages = grammarPassagesForSchool(school, A.data.profile.division);
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
  const rows = [...sessions, ...attempts].sort((a,b) => b.at - a.at).slice(0,1);
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
  return `<div class="section-title home-recent-head"><h2>최근 학습</h2><button class="text-button" data-go="records">전체 보기 ${icon('chevron')}</button></div><div class="home-recent-one">${rows.map(line).join('')}</div>`;
}
function homePrimaryAction(A) {
  const activePractice = A.data.active_practice_summary || null;
  if (activePractice) {
    const ranges = (activePractice.range_codes || []).map(code => recordRangeLabel({ division: activePractice.division, school: activePractice.school }, code)).join(' · ') || '선택 범위';
    return {
      kicker: activePractice.run_mode === 'test' ? '진행 중인 실전' : '진행 중인 연습',
      title: '이어서 마무리해요',
      detail: `${esc(ranges)} · ${esc(PRACTICE_TYPES[activePractice.mode] || '단어 학습')} · ${Number(activePractice.score_total || 0)}/${activePractice.target}`,
      meta: '진행 위치가 저장되어 있어요.',
      cta: '이어서 풀기',
      attrs: 'data-quick-practice="true"'
    };
  }

  const daily = A.data.daily_quest || null;
  if (daily?.target > 0) {
    const mix = daily.mix || {};
    return {
      kicker: '오늘의 추천 학습',
      title: `오늘은 ${daily.target}개만 끝내요`,
      detail: `오답 ${mix.wrong || 0} · 복습 ${mix.review || 0} · 새 단어 ${mix.new || 0}`,
      meta: '지금 필요한 단어만 자동으로 섞어 보여줘요.',
      cta: '오늘 학습 시작',
      attrs: 'data-quick-practice="true"'
    };
  }

  const recentReview = [...(A.data.sessions || [])]
    .sort((a,b) => b.created_at - a.created_at)
    .find(item => Number(item.wrong_count || 0) + Number(item.unanswered_count || 0) > 0);
  if (recentReview) {
    const review = Number(recentReview.wrong_count || 0) + Number(recentReview.unanswered_count || 0);
    const ranges = (recentReview.range_codes || []).map(code => recordRangeLabel(recentReview, code)).join(' · ') || '최근 범위';
    return {
      kicker: '최근 복습',
      title: `${ranges} 다시 잡아볼까요?`,
      detail: `다시 볼 단어 ${review}개 · 지난 기록 ${recentReview.score ?? 0}점`,
      meta: date(recentReview.created_at),
      cta: `${review}개 복습하기`,
      attrs: `data-review-practice="${recentReview.id}"`
    };
  }

  const recent = [...(A.data.sessions || [])].sort((a,b) => b.created_at - a.created_at)[0];
  if (recent) {
    const ranges = (recent.range_codes || []).map(code => recordRangeLabel(recent, code)).join(' · ') || '최근 범위';
    return {
      kicker: '오늘의 학습',
      title: `${ranges}를 다시 외워볼까요?`,
      detail: `${esc(PRACTICE_TYPES[recent.mode] || '단어 학습')} · 최근 ${recent.score ?? 0}점`,
      meta: '외운 뒤 시험에서 바로 확인할 수 있어요.',
      cta: '단어 외우기',
      attrs: 'data-study="vocab"'
    };
  }

  return {
    kicker: '오늘의 시작',
    title: '먼저 단어를 외워봐요',
    detail: '시험 범위에서 오늘 외울 단어를 골라 시작해요.',
    meta: '짧게 외우고 바로 확인하는 흐름으로 구성했어요.',
    cta: '단어 외우기 시작',
    attrs: 'data-study="vocab"'
  };
}
function homeWeek(A) {
  const today = new Date();
  const kst = new Date(today.getTime() + 9 * 3600000);
  const dow = kst.getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  const start = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - mondayOffset) - 9 * 3600000;
  const activeDays = new Set((A.data.sessions || []).filter(s => Number(s.total || 0) > 0).map(s => {
    const d = new Date(Number(s.created_at || 0) + 9 * 3600000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }));
  const labels = ['월','화','수','목','금','토','일'];
  return labels.map((label,index) => {
    const ts = start + index * 86400000;
    const d = new Date(ts + 9 * 3600000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    const current = key === (() => { const x = new Date(Date.now()+9*3600000); return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`; })();
    return { label, date: d.getUTCDate(), active: activeDays.has(key), current };
  });
}
function homeRank(A) {
  const rows = [...(A.data.ranking || [])].sort((a,b) => Number(b.xp || 0)-Number(a.xp || 0) || Number(b.total || 0)-Number(a.total || 0));
  const me = rows.find(item => item.is_me);
  if (!me || Number(me.xp || 0) <= 0) return '—';
  return rows.findIndex(item => item.is_me) + 1;
}
function compactGrowth(A) {
  const p = A.data.profile, g = A.data.stats;
  const rewardPoints = Number(g.reward_points || 0);
  const rank = homeRank(A);
  const week = homeWeek(A);
  const accuracy = Number(g.accuracy || 0);
  const practiceCount = Number(g.practice_count || 0);
  const level = Number(g.level || 1);
  const stage = Number(g.stage || 1);
  const percent = Math.max(3, Number(g.percent || 0));
  const pet = CHARACTERS[p.avatar_key || 'dog'] || CHARACTERS.dog;
  const petStageNames = ['알', '유년체', '성장체', '성숙체', '최종체'];
  const petStageName = petStageNames[Math.max(1, Math.min(5, stage)) - 1];
  const nextStageLevel = [5, 10, 15, 20, null][Math.max(1, Math.min(5, stage)) - 1];
  return `<section class="home-profile-hero-v1337 home-pet-evolution-v1341 stage-${stage}">
    <div class="home-pet-stage-v1337">
      <span class="home-level-badge-v1337"><small>LEVEL</small><b>${level}</b></span>
      <div class="home-pet-art-v1337">${avatar(p.avatar_key || 'dog', { accessory: p.avatar_accessory, frame: p.avatar_frame, stage, size: 'home-featured' })}</div>
      <span class="home-pet-status-v1337">${petStageName}</span>
    </div>
    <div class="home-profile-copy-v1337">
      <span class="home-profile-kicker-v1337">나의 성장 파트너 · ${petStageName}</span>
      <h1>${stage === 1 ? '???' : esc(pet.ko)} <small>${stage === 1 ? '부화를 기다리는 중' : esc(pet.type)}</small></h1>
      <div class="home-evolution-line-v1341"><span>${stage === 5 ? '최종 진화 완료' : `다음 진화 · Lv.${nextStageLevel}`}</span><b>${stage}/5</b></div>
      <div class="home-level-line-v1337"><b>Lv.${level}</b><span>다음 레벨까지 ${num(g.remaining || 0)} XP</span></div>
      <div class="home-xp-track-v1337" aria-label="레벨 진행률"><i style="width:${percent}%"></i></div>
      <div class="home-xp-meta-v1337"><span>누적 XP ${num(g.points || 0)}</span><strong>${Math.round(Number(g.percent || 0))}%</strong></div>
    </div>
  </section>
  <section class="home-main-metrics-v1337">
    <button class="rank" data-go="ranking"><span>내 순위</span><strong>${rank === '—' ? '—' : rank + '위'}</strong><small>이번 주 랭킹 보기</small></button>
    <button class="accuracy" data-go="records"><span>내 기록</span><strong>${accuracy}%</strong><small>최근 학습 정답률</small></button>
    <button class="sessions" data-go="records"><span>학습 횟수</span><strong>${num(practiceCount)}회</strong><small>누적 학습 기록</small></button>
  </section>
  <section class="home-mini-stats-v1337">
    <div><span>연속 학습</span><b>${Number(g.streak || 0)}일</b></div>
    <div><span>오늘 XP</span><b>+${num(g.today_xp || 0)}</b></div>
    <div><span>보유 포인트</span><b>${num(rewardPoints)}P</b></div>
  </section>
  <section class="home-week-card home-week-card-v1337">
    <div class="home-week-head"><div><span>이번 주 출석</span><strong>${Number(g.streak || 0)}일 연속 학습</strong></div><span class="streak-badge">${icon('flame')}${Number(g.streak || 0)} DAYS</span></div>
    <div class="home-week-days">${week.map(day => `<div class="${day.active ? 'active' : ''} ${day.current ? 'today' : ''}"><span>${day.label}</span><b>${day.active ? '✓' : day.date}</b></div>`).join('')}</div>
  </section>`;
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
  const passages = grammarPassagesForSchool(school, A.data.profile.division);
  if (passages.length) {
    const target = passages.find(p => !savedGrammarProgress(A, p)?.mastered) || passages[0];
    rows.push(`<button class="home-recommend-row" data-action="grammar-choice" data-grammar-id="${esc(target.id)}"><span>${icon('records')}</span><div class="grow"><b>어법·어휘 ${esc(target.number)}번</b><small>${esc(grammarExamLabel(target))} · ${target.sentences.length}문장</small></div>${icon('chevron')}</button>`);
  }
  return rows.length ? `<div class="section-title"><h2>추천 학습</h2></div><div class="home-recommend-list">${rows.join('')}</div>` : '';
}
function home(A) {
  const p = A.data.profile;
  return `<div class="home-context home-context-v1327"><div><span>SUMUS VOCA</span><b>${esc(p.school || A.school || '학교 미설정')} · ${esc(p.class_name || '')}</b></div></div>
    ${compactGrowth(A)}
    ${recentRecordCard(A)}`;
}
function studyHub(A) {
  return `<div class="page-heading study-simple-heading premium-page-heading"><span class="premium-eyebrow">LEARNING</span><h1>학습</h1></div>
  <div class="study-hub-grid study-hub-simple">
    <button class="study-hub-card vocab" data-study="vocab">
      <span class="study-hub-icon">${icon('practice')}</span>
      <div><span class="pill green">VOCAB</span><h2>단어 학습</h2></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>
    <button class="study-hub-card grammar" data-study="grammar">
      <span class="study-hub-icon">${icon('records')}</span>
      <div><span class="pill">GRAMMAR</span><h2>어법·어휘</h2></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>
  </div>`;
}
function grammarCards(A, passages) {
  return passages.map(p => {
    const saved = savedGrammarProgress(A, p);
    const mastered = Boolean(saved?.mastered);
    return `<button class="grammar-set-card premium ${mastered ? 'mastered' : ''}" data-action="grammar-choice" data-grammar-id="${esc(p.id)}">
      <div class="grammar-set-top">
        <span class="grammar-number">${esc(p.number)}</span>
        <div class="grow"><b>${esc(p.subtitle)}</b><small>${mastered ? '학습 완료' : p.sentences.length + '문장'}</small></div>
        <span class="grammar-state ${mastered ? 'master' : ''}">${mastered ? 'MASTER' : '학습'}</span>
      </div>
      <div class="grammar-set-cta">${mastered ? '다시 보기' : '시작하기'} ${icon('arrow')}</div>
    </button>`;
  }).join('');
}

function grammarStudy(A) {
  const school = A.data.profile.school || A.school || '';
  const middle = A.data.profile.division === 'middle';
  const isDanwon = school === '단원고';
  const isSeonbu = school === '선부고';
  const isGangseo = school === '강서고';
  const passages = isDanwon ? DANWONGO_PASSAGES : isGangseo ? GANGSEO_PASSAGES : [];

  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill green">GRAMMAR</span></div>
  <div class="page-heading grammar-heading"><h1>어법·어휘</h1></div>
  <section class="study-school-card locked"><div><span class="tiny muted">현재 학교</span><strong>${esc(school)}</strong></div><span class="school-fixed">${icon('shield')} 선생님 관리</span></section>
  ${middle ? (() => {
    const lesson = Number(A.middleGrammarLesson || 6);
    const selectedLesson = [6,7].includes(lesson) ? lesson : 6;
    const lessonPassages = MIDDLE_DONGA_YOON_BY_LESSON[selectedLesson] || [];
    const completed = lessonPassages.filter(p => savedGrammarProgress(A, p)?.mastered).length;
    return `
      <section class="grammar-range-head middle compact-v1339"><div><span class="eyebrow">중3 · 동아(윤정미)</span><h2>교과서 본문 어법 선택형</h2><p>문장을 읽고 알맞은 어법을 선택해요.</p></div></section>
      <div class="middle-grammar-tabs-v1339">
        ${[6,7].map(n => {
          const ps = MIDDLE_DONGA_YOON_BY_LESSON[n] || [];
          const done = ps.filter(p => savedGrammarProgress(A,p)?.mastered).length;
          return `<button data-middle-grammar-lesson="${n}" class="${selectedLesson === n ? 'selected' : ''}"><b>${n}과</b><small>${done}/${ps.length} 완료</small></button>`;
        }).join('')}
      </div>
      <div class="middle-grammar-summary-v1339"><b>${selectedLesson}과</b><span>${lessonPassages.length}개 본문 · ${completed}개 완료</span></div>
      <div class="grammar-set-list compact-v1339">${grammarCards(A, lessonPassages)}</div>
    `;
  })() : isDanwon ? `
    <section class="grammar-range-head"><div><span class="eyebrow">단원고 시험범위</span><h2>2025년 9월 인천교육청</h2></div><span class="grammar-range-count">${passages.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, passages)}</div>
  ` : isGangseo ? `
    <section class="grammar-range-head gangseo"><div><span class="eyebrow">강서고 시험범위 · 2026</span><h2>2026년 6월 부산교육청</h2></div><span class="grammar-range-count">${GANGSEO_PASSAGES.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, GANGSEO_PASSAGES)}</div>
  ` : isSeonbu ? `
    <section class="grammar-range-head seonbu current"><div><span class="eyebrow">선부고 시험범위 · 2026</span><h2>2026년 3월 서울교육청</h2></div><span class="grammar-range-count">${SEONBU_2026_PASSAGES.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, SEONBU_2026_PASSAGES)}</div>

    <div class="grammar-year-divider"><span>2025년 범위</span></div>
    <section class="grammar-range-head seonbu old"><div><span class="eyebrow">선부고 시험범위 · 2025</span><h2>2025년 9월 인천교육청</h2></div><span class="grammar-range-count">${SEONBU_2025_PASSAGES.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, SEONBU_2025_PASSAGES)}</div>
  ` : `
    <section class="grammar-empty-school"><span class="square-icon">${icon('records')}</span><div><b>현재 학교의 어법·어휘 범위를 준비 중이에요.</b><p>시험범위를 순서대로 추가하고 있어요.</p></div></section>
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
function highSchoolMemorizeState(A) {
  const { words, codes, selected } = getRanges(A);
  const normalized = codes.map(code => String(code));
  const selectedFirst = selected.map(code => String(code)).find(code => normalized.includes(code));
  if (!normalized.includes(String(A.memorizeRange || ''))) A.memorizeRange = selectedFirst || normalized[0] || '';
  const code = String(A.memorizeRange || '');
  return {
    words,
    codes,
    code,
    lessonWords: words.filter(word => String(word.range_code) === code)
  };
}
function memorizationWords(A) {
  if (A.data.profile.division === 'middle') return middleLessonState(A).lessonWords;
  return highSchoolMemorizeState(A).lessonWords;
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
    : (() => {
        const state = highSchoolMemorizeState(A);
        return schoolSwitch(A) + `<div class="memorize-range-strip" role="tablist" aria-label="학습 범위">${state.codes.map(range => {
          const code = String(range);
          const count = state.words.filter(word => String(word.range_code) === code).length;
          const selected = code === state.code;
          return `<button role="tab" aria-selected="${selected}" data-memorize-range="${esc(code)}" class="${selected ? 'selected' : ''}"><strong>${esc(rangeLabel(A.school, range))}</strong><small>${count}개</small></button>`;
        }).join('')}</div>`;
      })();
  const starredInScope = words.filter(word => stars.has(word.id));
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill green">VOCAB</span></div>
    <div class="page-heading memorize-heading premium-page-heading"><span class="premium-eyebrow">VOCABULARY</span><h1>단어 학습</h1></div>
    <section class="setup-section"><div class="step-label"><span>01</span>범위</div>${rangeUi}</section>
    <section class="memorize-shell">
      <div class="memorize-toolbar">
        <div class="segment compact"><button data-memorize-filter="all" class="${!starredOnly ? 'selected' : ''}">전체 ${words.length}</button><button data-memorize-filter="starred" class="${starredOnly ? 'selected' : ''}">★ 어려운 단어 ${starredInScope.length}</button></div>
        <button class="text-button" data-memorize-reveal-all="${allShown ? 'hide' : 'show'}">${allShown ? '전체 영어 보기' : '전체 뜻 보기'}</button>
      </div>
      <div class="memorize-list">${visible.length ? visible.map((word,index) => {
        const show = allShown || revealed.has(word.id);
        const star = stars.has(word.id);
        const front = show ? word.meaning : word.word;
        return `<div class="memorize-row ${show ? 'revealed' : ''} ${star ? 'starred' : ''}">
          <button class="memorize-star" data-memorize-star="${esc(word.id)}" aria-label="${star ? '어려운 단어 해제' : '어려운 단어 표시'}">${star ? '★' : '☆'}</button>
          <button class="memorize-word" data-memorize-word="${esc(word.id)}" aria-label="${esc(word.word)} ${show ? '영어 보기' : '뜻 보기'}"><span class="memorize-no">${index + 1}</span><strong>${esc(front)}</strong></button>
          <button class="memorize-sound" data-memorize-speak="${esc(word.id)}" aria-label="${esc(word.word)} 발음 듣기">${icon('sound')}</button>
        </div>`;
      }).join('') : '<div class="memorize-empty">표시할 단어가 없어요. 별표 필터를 해제하거나 범위를 선택해주세요.</div>'}</div>
    </section>`;
}
function durationText(seconds) {
  const sec = Math.max(0, Number(seconds || 0));
  const min = Math.floor(sec / 60), rest = sec % 60;
  return min ? `${min}분 ${String(rest).padStart(2,'0')}초` : `${rest}초`;
}
function vocabPractice(A) {
  return memorizationPanel(A);
}

function practice(A) {
  if (A.studyView === 'vocab') return vocabPractice(A);
  if (A.studyView === 'grammar') return grammarStudy(A);
  return studyHub(A);
}
function examTargetGrid(A, count) {
  return `<div class="practice-target-grid" role="group" aria-label="문항 수 선택">${[10,20,30].filter(n => count >= n).map(n => `<button data-practice-target="${n}" class="${A.target === n ? 'selected' : ''}">${n}<small>문제</small></button>`).join('')}<button data-practice-target="all" class="all ${A.target === 'all' ? 'selected' : ''}"><b>선택 범위 전체</b><small>${count}개 단어</small></button></div>`;
}
function examWritingPicker(A) {
  const items = [
    ['write_meaning','뜻 직접 쓰기','영어를 보고 뜻을 직접 입력'],
    ['spell','영어 직접 쓰기','뜻을 보고 영어 단어를 직접 입력'],
    ['eng2mean','뜻 4지선다','영어를 보고 알맞은 뜻 선택'],
    ['mean2eng','영어 4지선다','뜻을 보고 알맞은 영어 선택']
  ];
  return `<div class="primary-mode-grid writing-only-grid">${items.map(([key,label,help]) => `<button class="primary-mode-card ${A.mode === key ? 'selected' : ''}" data-mode="${key}"><span class="primary-mode-icon">${icon('records')}</span><div><b>${label}</b><small>${help}</small></div></button>`).join('')}</div>`;
}
function exam(A) {
  if (!A.examKind) {
    return `<div class="page-heading exam-choice-heading premium-page-heading"><span class="premium-eyebrow">TEST</span><h1>시험</h1></div>
      <div class="exam-kind-grid">
        <button class="exam-kind-card practice" data-exam-kind="practice"><span class="square-icon">${icon('practice')}</span><div><span class="pill green">PRACTICE</span><h2>연습시험</h2><p>문제마다 바로 채점</p></div>${icon('arrow')}</button>
        <button class="exam-kind-card test" data-exam-kind="test"><span class="square-icon">${icon('exam')}</span><div><span class="pill">TEST</span><h2>실전시험</h2><p>마지막에 한꺼번에 채점</p></div>${icon('arrow')}</button>
      </div>`;
  }
  if (!['write_meaning','spell','eng2mean','mean2eng'].includes(A.mode)) A.mode = 'write_meaning';
  const testMode = A.examKind === 'test';
  A.practiceRunMode = testMode ? 'test' : 'practice';
  const middle = A.data.profile.division === 'middle';
  let scopeUi = '', count = 0, scopeLabel = '';
  if (middle) {
    const state = middleLessonState(A);
    const selectedIds = new Set(state.selected);
    const size = [20,25,30].includes(Number(A.middleChunkSize)) ? Number(A.middleChunkSize) : 20;
    const startIndex = Math.max(0, Math.min(Number.isInteger(Number(A.middleStartIndex)) ? Number(A.middleStartIndex) : 0, Math.max(0, state.lessonWords.length - 1)));
    const selectedWords = state.lessonWords.slice(startIndex, startIndex + size);
    const effectiveWords = state.selected.length ? state.selected : selectedWords.map(word => word.id);
    if (!state.selected.length && state.lessonWords.length) A.middleWordIds = [...effectiveWords];
    count = effectiveWords.length;
    const firstWord = state.lessonWords[startIndex];
    const lastWord = state.lessonWords[Math.min(startIndex + count - 1, state.lessonWords.length - 1)];
    scopeLabel = firstWord ? `${state.code}과 · ${firstWord.word} ~ ${lastWord?.word || firstWord.word} · ${count}개` : '범위 미선택';
    scopeUi = `<div class="middle-lesson-tabs setup-choice-row">${state.codes.map(range => { const n = state.words.filter(word => String(word.range_code) === String(range)).length; return `<button data-middle-lesson="${esc(range)}" class="${String(range) === state.code ? 'selected' : ''}">${esc(range)}과 <small>${n}개</small></button>`; }).join('')}</div>
      <div class="middle-word-scope-v1339">
        <div class="middle-word-scope-head"><div><strong>시작 단어 선택</strong><small>오늘 외우기 시작한 첫 단어를 눌러주세요</small></div><b>${count}개</b></div>
        <div class="middle-word-checklist compact-v1339 start-word-list">${state.lessonWords.map((word,index) => `<button type="button" data-middle-start-index="${index}" class="${index === startIndex ? 'selected' : ''}"><span class="word-number">${index + 1}</span><span class="middle-word-copy"><b>${esc(word.word)}</b><small>${esc(word.meaning)}</small></span>${index === startIndex ? '<span class="start-mark">시작</span>' : ''}</button>`).join('')}</div>
        <div class="middle-range-controls">
          <div class="middle-word-scope-head"><div><strong>몇 개 외웠나요?</strong><small>시작 단어부터 자동으로 범위를 잡아요</small></div></div>
          <div class="segment compact"><button data-middle-chunk-size="20" class="${size === 20 ? 'selected' : ''}">20개</button><button data-middle-chunk-size="25" class="${size === 25 ? 'selected' : ''}">25개</button><button data-middle-chunk-size="30" class="${size === 30 ? 'selected' : ''}">30개</button></div>
          <div class="selected-range-card"><small>선택 범위</small><strong>${firstWord ? `${esc(firstWord.word)} ~ ${esc(lastWord?.word || firstWord.word)}` : '단어를 선택해주세요'}</strong><span>${count}개 · ${startIndex + 1}번 ~ ${Math.min(startIndex + count, state.lessonWords.length)}번</span></div>
          <div class="range-nav"><button data-middle-range-move="prev" ${startIndex <= 0 ? 'disabled' : ''}>← 이전</button><button data-middle-range-move="next" ${startIndex + size >= state.lessonWords.length ? 'disabled' : ''}>다음 →</button></div>
        </div>
      </div>`;
  } else {
    const state = getRanges(A);
    const textbookCodes = state.codes.filter(code => /^L\d+$/i.test(String(code)));
    const mockCodes = state.codes.filter(code => !/^L\d+$/i.test(String(code)));
    const availableTypes = [['mock','모의고사',mockCodes],['textbook','교과서',textbookCodes]].filter(([, , codes]) => codes.length);
    if (!availableTypes.some(([key]) => key === A.highRangeType)) A.highRangeType = availableTypes[0]?.[0] || 'mock';
    const visibleCodes = A.highRangeType === 'textbook' ? textbookCodes : mockCodes;
    const visibleSelected = state.selected.filter(code => visibleCodes.includes(code));
    count = state.words.filter(word => visibleSelected.includes(word.range_code)).length;
    scopeLabel = visibleSelected.map(code => recordRangeLabel({ division: 'high', school: A.school }, code)).join(' · ') || '범위 미선택';
    const typeTabs = availableTypes.length > 1 ? `<div class="segment exam-source-tabs">${availableTypes.map(([key,label]) => `<button data-high-range-type="${key}" class="${A.highRangeType === key ? 'selected' : ''}">${label}</button>`).join('')}</div>` : '';
    const picker = `<div class="range-grid">${visibleCodes.map(c => `<label class="range-option"><input type="checkbox" data-range="${esc(c)}" ${visibleSelected.includes(c) ? 'checked' : ''}><span>${esc(rangeLabel(A.school, c))}<small>${state.words.filter(w => w.range_code === c).length}개 단어</small></span></label>`).join('')}</div><div class="scope-tools"><span id="scope-count">${visibleSelected.length}개 범위 · ${count}개 단어</span><div><button data-high-range-all="true">전체 선택</button><button data-high-range-all="false">해제</button></div></div>`;
    scopeUi = schoolSwitch(A) + typeTabs + picker;
  }
  const target = middle ? count : (A.target === 'all' ? count : Math.min(count, Number(A.target || 20)));
  return `<div class="exam-mode-switch segment"><button data-exam-kind="practice" class="${!testMode ? 'selected' : ''}">연습시험</button><button data-exam-kind="test" class="${testMode ? 'selected' : ''}">실전시험</button></div>
    <div class="page-heading exam-shared-heading"><h1>${testMode ? '실전시험' : '연습시험'}</h1></div>
    <section class="setup-section"><div class="step-label"><span>01</span>시험 범위</div>${scopeUi}</section>
    ${middle ? '' : `<section class="setup-section"><div class="step-label"><span>02</span>문항 수</div>${examTargetGrid(A, count)}</section>`}
    <section class="setup-section"><div class="step-label"><span>${middle ? '02' : '03'}</span>시험 방식</div>${examWritingPicker(A, testMode)}</section>
    <div class="exam-start-inline"><p>${esc(scopeLabel)} · ${target || 0}문제 · ${esc(PRACTICE_TYPES[A.mode] || '뜻쓰기')}</p><button class="btn primary full" data-action="start-exam-run" ${count ? '' : 'disabled'}>${testMode ? '실전시험 시작' : '연습시험 시작'} ${icon('arrow')}</button></div>`;
}

function ranking(A) {
  const mode = A.rankMode || 'xp';
  const scope = A.rankScope || 'all';
  const period = A.rankPeriod || 'week';
  const metric = period === 'all' ? (mode === 'streak' ? 'all_streak' : `all_${mode}`) : mode;
  const all = [...A.data.ranking];
  const filtered = scope === 'all' ? all : all.filter(p => p.grade === scope);
  const items = filtered.sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0) || Number(b.xp || 0) - Number(a.xp || 0));
  const unit = mode === 'xp' ? ' XP' : mode === 'streak' ? '일' : '문제';
  const myIndex = items.findIndex(p => p.is_me);
  const scopeLabel = scope === 'all' ? '전체' : scope;
  const info = A.data.ranking_period || {};
  const periodTitle = period === 'week' ? (info.label || '이번 주') : '통합 누적';
  const periodRange = period === 'week' ? (info.range || '월요일 ~ 일요일') : '전체 학습 기록';
  const rankNo = item => Number(item[metric] || 0) > 0 ? items.findIndex(x => Number(x[metric] || 0) === Number(item[metric] || 0)) + 1 : '—';
  const scopeOptions = [['all','전체'],['중2','중2'],['중3','중3'],['고1','고1']];
  const periodOptions = [['week','이번 주'],['all','통합']];
  const modeOptions = [['xp','성장 XP'],['total','연습량'],['streak','연속 학습']];
  return `<div class="page-heading rank-heading-v1326"><h1>SUMUS 랭킹</h1><p>시험 점수가 아닌 실제 학습 기록으로 올라가요.</p></div>
    <div class="rank-filter-bar" aria-label="랭킹 필터">
      <label><span>학년</span><select data-rank-scope-select>${scopeOptions.map(([k,label]) => `<option value="${k}" ${scope === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>기간</span><select data-rank-period-select>${periodOptions.map(([k,label]) => `<option value="${k}" ${period === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>기준</span><select data-rank-mode-select>${modeOptions.map(([k,label]) => `<option value="${k}" ${mode === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    <p class="rank-period-caption">${esc(periodTitle)} · ${esc(periodRange)}</p>
    ${myIndex >= 0 ? `<div class="my-rank-card"><span>내 ${scopeLabel} 순위</span><strong>${rankNo(items[myIndex])}<small>위</small></strong><p>${num(items[myIndex][metric] || 0)}${unit} · ${esc(periodTitle)}</p></div>` : ''}
    <div class="rank-list">${items.length ? items.map((p, index) => `<div class="rank-row ${p.is_me ? 'me' : ''} ${index < 3 && Number(p[metric] || 0) ? 'top-rank top-' + (index + 1) : ''}"><span class="rank-number">${rankNo(p)}</span>${avatar(p.avatar_key, { size: 'mini' })}<div class="grow"><strong>${esc(p.display_name)} ${p.is_me ? '<span class="pill green">나</span>' : ''}</strong><small><span class="rank-grade">${esc(p.grade || '')}</span> · ${p.private ? '프로필 비공개' : `Lv.${p.level} · ${CHARACTERS[p.avatar_key]?.ko || '루미'}`}</small></div><span class="rank-score">${num(p[metric] || 0)}${unit}</span></div>`).join('') : empty('ranking', `${scopeLabel}에 아직 연습 기록이 없어요`, '학습을 시작하면 순위가 바로 생겨요.')}</div>
    <p class="quiet-note">주간 기록은 매주 월요일 새로 시작하고 통합 기록은 계속 누적돼요. 시험 성적은 랭킹에 포함하지 않아요.</p>`;
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
      return `<button class="record-row full" style="width:100%;text-align:left" data-practice-record="${s.id}"><span class="square-icon">${icon('practice')}</span><div class="grow"><strong>${esc(ranges)} · ${esc(PRACTICE_TYPES[s.mode] || '쓰기')} · ${s.run_mode === 'test' ? '실전시험' : '연습시험'}</strong><p>${s.correct}/${s.total} 정답 · ${durationText(s.duration_sec)}${s.auto_submitted ? ' · 시간 종료' : ''}</p><p>${date(s.created_at)}</p></div><div class="result">${score}점<small>${disputeState(s.id).replace(/^ · /,'') || (s.run_mode === 'test' ? (s.shared_to_teacher_at ? '선생님 전송 완료' : '실전 · 미전송') : '연습 기록')}</small></div></button>`;
    }
    const a = row.item, e = A.data.exams.find(exam => exam.id === a.exam_id);
    return `<button class="record-row full" style="width:100%;text-align:left" data-result="${a.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><strong>${esc(e?.title || '실전시험')}</strong><p>${EXAM_TYPES[e?.exam_type]?.label || ''}${a.result_visibility === 'visible' && a.correct !== undefined ? ' · ' + a.correct + '/' + a.total + ' 정답' : ' · 제출 완료'}</p><p>${date(a.submitted_at)}</p></div><div class="result">${a.result_visibility === 'visible' && a.score !== undefined ? a.score + '점' : '공개 대기'}<small>${a.result_visibility === 'visible' ? (disputeState(a.id).replace(/^ · /,'') || (a.grading_status === 'provisional' ? '임시 점수' : '시험 기록')) : '선생님 공개 대기'}</small></div></button>`;
  };
  return `<div class="page-heading records-heading-v1327"><span class="premium-eyebrow">MY RECORD</span><h1>내 기록</h1><p>점수보다 중요한 건 꾸준히 쌓인 학습이에요.</p></div>
    <section class="record-summary-v1327"><div class="record-summary-main"><span>이번 주 평균</span><strong>${weeklyAvg === null ? '—' : weeklyAvg}<small>${weeklyAvg === null ? '' : '점'}</small></strong><p>${weeklyScores.length}회 학습 기록</p></div><div class="record-summary-side"><div><span>최고 점수</span><b>${best === null ? '—' : best + '점'}</b></div><div><span>누적 학습</span><b>${combined.length}회</b></div><div><span>누적 문제</span><b>${num(totalQuestions)}</b></div></div></section>
    <section class="record-achievements-v1327">${achievementSection(A, true)}</section>
    <div class="segment record-filter-v1327"><button data-record-tab="all" class="${tab === 'all' ? 'selected' : ''}">전체</button><button data-record-tab="selftest" class="${tab === 'selftest' ? 'selected' : ''}">실전</button><button data-record-tab="practice" class="${tab === 'practice' ? 'selected' : ''}">연습</button></div>
    <div class="record-timeline-v1327">${visible.length ? visible.map(rowHtml).join('') : empty('records','아직 기록이 없어요','첫 학습을 마치면 여기에 기록이 쌓여요.')}</div>`;
}
function studio(A) {
  const legacyPet = { lumi:'dog', nox:'cat', blaze:'dog', tide:'cat', zeph:'dragon', terra:'panda' };
  A.style ??= { avatar_key: CHARACTERS[A.data.profile.avatar_key] ? A.data.profile.avatar_key : (legacyPet[A.data.profile.avatar_key] || 'dog'), avatar_accessory: A.data.profile.avatar_accessory || 'none', avatar_frame: A.data.profile.avatar_frame || 'basic', avatar_title: A.data.profile.avatar_title || 'rookie' };
  const s = A.style, g = A.data.stats, tab = A.studioTab || 'character', c = CHARACTERS[s.avatar_key];
  const groups = { accessory: ACCESSORIES, frame: FRAMES, title: TITLES };
  let body = tab === 'character' ? `<div class="pet-choice-head"><span>MY PARTNER</span><h2>나의 학습 파트너를 선택해 주세요!</h2><p>어떤 친구와 함께 공부할까요?</p></div><div class="character-grid pet-choice-grid">${Object.entries(CHARACTERS).map(([key, c]) => `<button data-style="avatar_key" data-value="${key}" class="character-option ${s.avatar_key === key ? 'selected' : ''}" aria-pressed="${s.avatar_key === key}">${avatar(key)}<b>${c.ko}</b><small>${c.type}</small></button>`).join('')}</div><p class="quiet-note">능력은 모두 같아요. 마음이 가는 친구를 골라요.</p>` : `<div class="reward-grid">${Object.entries(groups[tab]).map(([key, item]) => { const open = unlocked(item, g); return `<button data-style="avatar_${tab}" data-value="${key}" class="reward-item ${s['avatar_' + tab] === key ? 'selected' : ''}" ${open ? '' : 'disabled'}>${icon(open ? tab === 'title' ? 'records' : 'sparkle' : 'lock')}<b>${item.name}</b><small>${open ? '사용 가능' : item.level ? `Lv.${item.level}에 열려요` : item.combo ? '10연속 정답 달성' : '7일 연속 학습'}</small></button>`; }).join('')}</div>`;
  return `<div class="page-heading studio-page-heading"><h1>${A.data.profile.avatar_key ? '내 학습 파트너' : '함께 성장할 친구'}</h1><p>${A.data.profile.avatar_key ? '언제든 마음에 드는 친구로 바꿀 수 있어요.' : '처음의 선택. 언제든 바꿀 수 있어요.'}</p></div><div class="studio-preview">${avatar(s.avatar_key, { stage: g.stage, accessory: s.avatar_accessory, frame: s.avatar_frame })}<h2>${c.ko} <span class="tiny muted">Lv.${g.level}</span></h2><p>${TITLES[s.avatar_title].name}</p></div><div class="segment">${[['character', '캐릭터'], ['accessory', '장식'], ['frame', '프레임'], ['title', '칭호']].map(([k, label]) => `<button data-studio-tab="${k}" class="${tab === k ? 'selected' : ''}">${label}</button>`).join('')}</div>${body}<button class="btn primary full" data-action="save-style">${A.data.profile.avatar_key ? '이 모습으로 저장' : '함께 시작하기'}</button><div class="section-title"><h2>다음 성장의 선물</h2></div><div class="roadmap">${[[3, '헤드셋'], [5, '실버 프레임'], [6, '글래스'], [9, '스타 핀'], [10, '블루 라인'], [15, '오로라'], [18, '크라운'], [20, '골드']].map(([lv, name]) => `<div><div class="milestone ${g.level >= lv ? 'done' : ''}">${icon(g.level >= lv ? 'check' : 'lock')}</div><b>${name}</b><small>Lv.${lv}</small></div>`).join('')}</div>`;
}
export function updateRangeSummary(A) {
  const { selected } = getRanges(A);
  const count = selectedCount(A);
  if ($('#scope-count')) $('#scope-count').textContent = `${selected.length}개 범위 · ${count}개 단어`;
  const all = $('[data-all-count]'); if (all) all.textContent = `${count}개 단어 모두 보기`;
  const start = $('[data-action="start-exam-run"]'); if (start) start.disabled = !selectedCount(A);
}
