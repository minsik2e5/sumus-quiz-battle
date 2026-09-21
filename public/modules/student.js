import { CHARACTERS, ACCESSORIES, FRAMES, TITLES, PRACTICE_TYPES, EXAM_TYPES, unlocked, levelInfo, dayKey } from './core.js';
import { icon, esc, num, date, rangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar } from './character.js';
export const studentTabs = [['home', '홈', 'home'], ['practice', '연습', 'practice'], ['exam', '시험', 'exam'], ['ranking', '랭킹', 'ranking'], ['records', '기록', 'records']];
export function shell(A, content) {
  const p = A.data.profile;
  return `<div class="student-app"><main class="student-main"><header class="app-header"><div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div><button class="profile-dot" data-action="account" aria-label="내 계정">${esc(p.display_name.slice(0, 1))}</button></header>${content}</main><nav class="bottom-nav" aria-label="주 메뉴">${studentTabs.map(([id, name, i]) => `<button data-go="${id}" class="${A.tab === id ? 'active' : ''}" ${A.tab === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${name}</span></button>`).join('')}</nav></div>`;
}
export function studentPage(A) {
  return shell(A, ({ home, practice, exam, ranking, records, studio }[A.tab] || home)(A));
}
export function getRanges(A, school = A.school) {
  const words = A.data.books.filter(b => b.school === school).flatMap(b => b.words);
  const codes = [...new Set(words.map(w => w.range_code))];
  A.ranges[school] ??= codes.slice(0, 2);
  return { words, codes, selected: A.ranges[school] };
}
export function selectedCount(A) { const { words, selected } = getRanges(A); return words.filter(w => selected.includes(w.range_code)).length; }
export function schoolSwitch(A) {
  const available = (A.data.schools || []).filter(s => A.data.books.some(b => b.school_id === s.id || b.school === s.name));
  return `<div class="segment school-segment" aria-label="학교 선택">${available.map(s => `<button data-school="${esc(s.name)}" class="${s.name === A.school ? 'selected' : ''}" aria-pressed="${s.name === A.school}">${esc(s.name)}</button>`).join('')}</div>`;
}
export function rangePicker(A, teacher = false) {
  const { words, codes, selected } = getRanges(A);
  return `<div class="${teacher ? 'teacher-range' : 'range-grid'}">${codes.map(c => `<label class="range-option"><input type="checkbox" data-range="${c}" ${selected.includes(c) ? 'checked' : ''} aria-label="${esc(rangeLabel(A.school, c))}"><span>${esc(rangeLabel(A.school, c))}<small>${words.filter(w => w.range_code === c).length}개 단어</small></span></label>`).join('')}</div><div class="scope-tools"><span id="scope-count">${selected.length}개 범위 · ${selectedCount(A)}개 단어</span><div><button data-range-all="true">전체 선택</button><button data-range-all="false">해제</button></div></div>`;
}
function home(A) {
  const { profile: p, stats: g, exams, assignments } = A.data, c = CHARACTERS[p.avatar_key] || CHARACTERS.lumi;
  const available = exams.filter(e => e.due_at > Date.now()).slice(0, 2);
  const task = assignments.find(a => a.due_at > Date.now()), goal = 20, done = Math.min(g.today_total, goal);
  return `<div class="row between"><div><p class="hello">${esc(p.display_name)}님, 반가워요</p><h1 class="home-title">오늘도, 한 걸음 더.</h1></div>${g.streak ? `<span class="streak-badge">${icon('flame')}${g.streak}일째</span>` : ''}</div>
  <section class="character-hero" aria-label="내 캐릭터 성장"><div class="hero-top"><div><b class="eyebrow">${c.name}</b><small>${c.type}</small></div><span class="pill">${esc(TITLES[p.avatar_title || 'rookie']?.name || '첫걸음')}</span></div><div class="character-stage">${avatar(p.avatar_key, { stage: g.stage, accessory: p.avatar_accessory, frame: p.avatar_frame })}</div><div class="hero-growth"><div class="row between"><strong>Lv.${String(g.level).padStart(2, '0')}<span>${c.ko}</span></strong><button class="text-button" data-go="studio">내 캐릭터 ${icon('chevron')}</button></div><div class="progress" role="progressbar" aria-label="캐릭터 성장" aria-valuenow="${Math.round(g.percent)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${g.percent}%"></i></div><div class="growth-caption"><span>${g.level === 50 ? '최고 레벨에 도달했어요' : `다음 레벨까지 ${num(g.remaining)}P`}</span><span>${num(g.current)} / ${num(g.need)}P</span></div></div></section>
  <div class="section-title"><h2>오늘의 한 걸음</h2><span class="tiny muted">${done} / ${goal}문제</span></div><section class="mission"><div class="mission-label">${icon(done >= goal ? 'check' : 'leaf')}${done >= goal ? '오늘 목표를 달성했어요' : '매일 조금씩, 꾸준하게'}</div><h2 class="mission-title">${done >= goal ? '좋은 흐름, 이어가 볼까요?' : '단어 20개와 친해지기'}</h2><button class="btn primary full" data-go="practice"><span>${A.data.active_practice ? '하던 연습 이어가기' : '연습 시작하기'}</span>${icon('arrow')}</button><div class="today-strip"><span>오늘 학습<strong>${num(g.today_total)}개</strong></span><span>획득 포인트<strong>+${num(g.today_xp)}P</strong></span></div></section>
  ${task ? `<div class="section-title"><h2>선생님이 남긴 연습</h2></div><button class="exam-row" data-assignment="${task.id}"><span class="square-icon">${icon('practice')}</span><div class="grow"><h3>${esc(task.title)}</h3><p>${task.target_questions}문제 · ${date(task.due_at)}까지</p></div>${icon('chevron')}</button>` : ''}
  <div class="section-title"><h2>배정된 실전시험</h2><button class="text-button" data-go="exam">모두 보기 ${icon('chevron')}</button></div>${available.length ? available.map(e => `<button class="exam-row" data-exam="${e.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><h3>${esc(e.title)}</h3><p>${EXAM_TYPES[e.exam_type].label} · ${e.question_count}문제</p></div>${icon('chevron')}</button>`).join('') : `<p class="quiet-note">지금은 배정된 시험이 없어요.</p>`}`;
}
function practice(A) {
  const count = selectedCount(A);
  return `<div class="page-heading"><h1>내 속도로, 연습</h1><p>범위를 고르면, 약한 단어부터 익혀요.</p></div><div class="step-label"><span>01</span>학교 선택</div>${schoolSwitch(A)}<div class="step-label"><span>02</span>연습할 범위</div>${rangePicker(A)}<div class="step-label"><span>03</span>연습 방식</div><div class="mode-grid">${Object.entries(PRACTICE_TYPES).map(([k, name]) => `<button class="mode-option ${A.mode === k ? 'selected' : ''}" data-mode="${k}" aria-pressed="${A.mode === k}">${icon(k === 'listen' ? 'sound' : k === 'mixed' ? 'sparkle' : ['write_meaning', 'spell', 'scramble', 'initial', 'vowelblank'].includes(k) ? 'records' : 'practice')}${name}${k === 'write_meaning' ? '<span class="grow"></span><span class="pill blue">추천</span><small class="mode-help">영어를 보고 뜻을 직접 입력</small>' : ''}</button>`).join('')}</div><div class="practice-amount"><span class="tiny muted">한 번에 학습할 양</span><div class="practice-target-grid" role="group" aria-label="학습량 선택">${[10, 20, 30].map(n => `<button data-practice-target="${n}" class="${A.target === n ? 'selected' : ''}" aria-pressed="${A.target === n}">${n}<small>문제</small></button>`).join('')}<button data-practice-target="all" class="all ${A.target === 'all' ? 'selected' : ''}" aria-pressed="${A.target === 'all'}"><b>선택 범위 전체</b><small data-all-count>${count}개 단어 모두 보기</small></button></div></div><div class="practice-launch"><button class="btn primary full" data-action="start-practice" ${!count ? 'disabled' : ''}>${A.data.active_practice ? '하던 연습 이어가기' : '연습 시작하기'} ${icon('arrow')}</button><p>${A.target === 'all' ? '선택한 단어를 중복 없이 모두 본 뒤, 틀린 단어를 복습해요.' : '틀린 단어는 잠시 뒤 다시 나와요.'}</p></div>`;
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
  const period = A.rankPeriod || 'week';
  const mode = A.rankMode || 'xp';
  const metric = period === 'all' ? (mode === 'streak' ? 'all_streak' : `all_${mode}`) : mode;
  const items = [...A.data.ranking].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0));
  const unit = mode === 'xp' ? 'P' : mode === 'streak' ? '일' : '문제';
  const info = A.data.ranking_period || {};
  const periodTitle = period === 'week' ? (info.label || '이번 주') : '통합 누적';
  const periodRange = period === 'week' ? (info.range || '월요일 ~ 일요일') : '첫 학습 기록부터 지금까지';
  const note = period === 'week'
    ? '주간 기록은 한국시간 기준 매주 월요일 00:00에 새로 시작해요. 이전 기록은 통합에 계속 남아요.'
    : '통합은 기존 학습 기록을 모두 누적해서 보여줘요. 주간 리셋과 관계없이 기록은 삭제되지 않아요.';
  return `<div class="page-heading"><h1>학원 전체순위</h1><p>학교와 반을 나누지 않은 SUMUS 전체 연습 기록</p></div>
  <div class="rank-intro"><div class="eyebrow">SUMUS ACADEMY</div><h2>함께 자라는 우리.</h2><p>각자의 속도로 쌓아가는 기록이에요.</p></div>
  <div class="segment" aria-label="랭킹 기간"><button data-rank-period="week" class="${period === 'week' ? 'selected' : ''}">주간</button><button data-rank-period="all" class="${period === 'all' ? 'selected' : ''}">통합</button></div>
  <div style="margin:12px 0 14px;padding:13px 15px;border:1px solid #eaecf0;border-radius:15px;background:#f9fafb;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong style="font-size:14px">${esc(periodTitle)}</strong><span class="tiny muted">${esc(periodRange)}</span></div>
  <div class="segment" aria-label="랭킹 기준">${[['xp', '성장 포인트'], ['total', '연습량'], ['streak', '연속 학습']].map(([k, label]) => `<button data-rank-mode="${k}" class="${mode === k ? 'selected' : ''}">${label}</button>`).join('')}</div>
  <div style="margin-top:15px">${items.length ? items.map(p => `<div class="rank-row ${p.is_me ? 'me' : ''}"><span class="rank-number">${Number(p[metric] || 0) ? (items.findIndex(x => Number(x[metric] || 0) === Number(p[metric] || 0)) + 1) : '—'}</span>${avatar(p.avatar_key, { size: 'mini' })}<div class="grow"><strong>${esc(p.display_name)} ${p.is_me ? '<span class="pill blue">나</span>' : ''}</strong><small>${p.private ? '프로필 비공개' : `Lv.${p.level} · ${CHARACTERS[p.avatar_key]?.ko || '루미'}`}</small></div><span class="rank-score">${num(p[metric] || 0)}${unit}</span></div>`).join('') : empty('ranking', '아직 연습 기록이 없어요')}</div>
  <p class="quiet-note">${esc(note)}<br>시험 성적은 랭킹에 포함하지 않아요.</p>`;
}
function records(A) {
  const g = A.data.stats, tab = A.recordTab || 'practice';
  const attempts = A.data.attempts.filter(a => a.status === 'submitted').sort((a, b) => b.submitted_at - a.submitted_at);
  return `<div class="page-heading"><h1>쌓이는 나의 기록</h1><p>작은 연습이 이렇게 모였어요.</p></div><div class="segment"><button data-record-tab="practice" class="${tab === 'practice' ? 'selected' : ''}">연습 기록</button><button data-record-tab="exam" class="${tab === 'exam' ? 'selected' : ''}">시험 기록</button></div>${tab === 'practice' ? `<div class="record-stats"><div><strong>${num(g.practice_count)}</strong><span>연습 횟수</span></div><div><strong>${g.accuracy}%</strong><span>정답률</span></div><div><strong>Lv.${g.level}</strong><span>현재 성장</span></div></div>${A.data.sessions.length ? A.data.sessions.map(s => `<div class="record-row"><span class="square-icon">${icon('practice')}</span><div class="grow"><strong>${PRACTICE_TYPES[s.mode] || '연습'} · ${s.total}문제</strong><p>${s.school || ''} · 정답률 ${Math.round(s.correct / s.total * 100)}% · 최고 ${s.best_combo}연속</p><p>${date(s.created_at)}</p></div><div class="result">+${num(s.xp)}<small>포인트</small></div></div>`).join('') : empty('records', '첫 연습을 기다리고 있어요', '연습을 마치면 여기에 기록이 쌓여요.')}` : `<div style="margin-top:18px">${attempts.length ? attempts.map(a => { const e = A.data.exams.find(e => e.id === a.exam_id); return `<button class="record-row full" style="width:100%;text-align:left" data-result="${a.id}"><span class="square-icon">${icon('exam')}</span><div class="grow"><strong>${esc(e?.title || '실전시험')}</strong><p>${EXAM_TYPES[e?.exam_type]?.label || ''}</p><p>${date(a.submitted_at)}</p></div><div class="result">${a.score === undefined ? '제출' : a.score + '점'}<small>${a.score === undefined ? '결과 비공개' : `${a.correct} / ${a.total} 정답`}</small></div></button>`; }).join('') : empty('exam', '아직 응시 기록이 없어요')}</div>`}`;
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
