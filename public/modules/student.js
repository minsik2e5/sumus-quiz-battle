import { CHARACTERS, ACTIVE_PET_KEYS, STANDARD_PET_KEYS, LEGENDARY_PET_KEYS, ACCESSORIES, FRAMES, PRACTICE_TYPES, EXAM_TYPES, PRACTICE_SECONDS_PER_QUESTION, PET_FORMS, PET_FORM_LEVELS, EGG_PRICE, petForm, unlocked, levelInfo, dayKey, cardTier, testDurationSec, TEST_LEAVE_LIMIT } from './core.js';
import { icon, esc, num, date, rangeLabel, recordRangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar, petKey, RUN_SHEETS } from './character.js';
import { knownWords } from './flashcards.js';
import { petDisplayName, petJosa } from './pet-moments.js';
import { TITLES, TITLE_KEYS } from './titles.js';
import { titleBadge, titleEmblem, tierEmblem, coin, trophy, uiArt, artOr } from './emblems.js';
import { titlesPage, titleState, titleCount } from './titles-ui.js';
import { tournamentCard } from './tournament-ui.js';
import { shownTitle } from './league-ui.js';
import { arcadePage, gachaBookPage, capsuleArt } from './arcade.js';
import { petBookPage } from './petbook.js';
import { ATTENDANCE_REWARDS, ATTENDANCE_TICKETS, GACHA_ITEMS, GACHA_TIERS } from './rewards.js';
// V13.68 menu: what students do. 학습 holds word study, tests and records; 나 holds what they
// collect. Pages without their own button light up the one they belong to.
export const studentTabs = [['home', '홈', 'home'], ['practice', '학습', 'practice'], ['yacha', '야차전', 'battle'], ['arcade', '놀이터', 'arcade'], ['me', '나', 'user']];
// V13.91 drawn menu icons (asset list 08-1·2), used once they are in ART_READY.
const NAV_ART = { home: 'nav-home', practice: 'nav-study', yacha: 'nav-yacha', arcade: 'nav-arcade', me: 'nav-me' };
const NAV_OF = { exam: 'practice', records: 'practice', ranking: 'home', studio: 'me', titles: 'me', gachabook: 'me', petbook: 'me' };
// V13.70 the ranking also opens from 나 (A.rankFrom), and then belongs to 나.
export const navOf = (tab, A = null) => tab === 'ranking' && A?.rankFrom === 'me' ? 'me' : NAV_OF[tab] || tab;
// V13.66: coins (코인) sit in the header on every tab; tapping opens the wallet.
function coinChip(A) {
  const balance = Number(A.data.stats?.points_balance ?? 0);
  return `<button class="coin-chip-v1366" data-action="coins" aria-label="내 코인 ${num(balance)}개 · 코인 지갑 열기">${coin()}<b>${num(balance)}</b></button>`;
}
export function shell(A, content) {
  const p = A.data.profile;
  return `<div class="student-app"><main class="student-main"><header class="app-header"><div class="brand"><img src="/sumus-logo-green.svg" alt=""><div>SUMUS <span>VOCA</span></div></div>${p.preview_owner_id ? '<button class="preview-exit-v1359" data-action="exit-student-preview">← 교사 화면</button>' : ''}${A.data.stats?.needs_pet_pick ? '' : coinChip(A)}<button class="profile-dot" data-action="account" aria-label="내 계정">${esc(p.display_name.slice(0, 1))}</button></header>${content}</main><nav class="bottom-nav" aria-label="주 메뉴"><div class="nav-brand" aria-hidden="true"><img src="/sumus-logo-green.svg" alt=""><span>SUMUS <b>VOCA</b></span></div>${studentTabs.map(([id, name, i]) => `<button data-go="${id}" class="${navOf(A.tab, A) === id ? 'active' : ''}" ${navOf(A.tab, A) === id ? 'aria-current="page"' : ''}>${artOr(NAV_ART[id], icon(i), 'nav-art')}<span>${name}</span></button>`).join('')}</nav></div>`;
}
export function studentPage(A) {
  return shell(A, ({ home, practice, exam, ranking, records, studio, titles: titlesPage, arcade: arcadePage, yacha: yachaPage, me: mePage, gachabook: gachaBookPage, petbook: petBookPage }[A.tab] || home)(A));
}
// V13.112 시험 구분: a range belongs to 중간고사 (midterm) or 기말고사 (final) by the book it is in
// (books without exam_period are 중간고사). Where a school has both, the range pickers show two
// folders (기말고사 first, open); a school with only one kind shows the plain list as before.
const PERIOD_LABEL = { final: '기말고사', midterm: '중간고사' };
const periodMaps = new WeakMap();
function codePeriods(A) {
  const books = A.data?.books || [];
  let map = periodMaps.get(books);
  if (!map) {
    map = new Map();
    for (const book of books) {
      const period = book.exam_period === 'final' ? 'final' : 'midterm';
      for (const code of new Set((book.words || []).map(word => String(word.range_code)))) if (!map.has(code) || period === 'final') map.set(code, period);
    }
    periodMaps.set(books, map);
  }
  return map;
}
export const periodOfCode = (A, code) => codePeriods(A).get(String(code)) || 'midterm';
export function periodGroups(A, codes) {
  const groups = ['final', 'midterm'].map(period => ({ period, label: PERIOD_LABEL[period], codes: codes.filter(code => periodOfCode(A, code) === period) })).filter(group => group.codes.length);
  return groups.length > 1 ? groups : [{ period: null, label: '', codes }];
}
// `option(code)` makes one range; `wrap` is the class of the box that holds them.
// The pickers that already have 모의고사 / 교과서 tabs (단어 학습, 시험 설정, 연습 시작) get 기말고사 / 중간고사
// tabs above them instead of folders: `activePeriod` is the kind shown now (null where a school has
// only one kind), `inPeriod` keeps the ranges of that kind, `periodTabs` draws the two buttons.
export function activePeriod(A, codes) {
  const groups = periodGroups(A, codes);
  if (!groups[0].period) return null;
  if (!groups.some(group => group.period === A.rangePeriod)) A.rangePeriod = groups[0].period;
  return A.rangePeriod;
}
export const inPeriod = (A, period, code) => !period || periodOfCode(A, code) === period;
export function periodTabs(A, codes, attr = 'data-range-period') {
  const groups = periodGroups(A, codes), active = activePeriod(A, codes);
  return groups[0].period ? `<div class="segment exam-source-tabs period-tabs" role="group" aria-label="시험 구분">${groups.map(group => `<button type="button" ${attr}="${group.period}" class="${active === group.period ? 'selected' : ''}" aria-pressed="${active === group.period}">${group.label}</button>`).join('')}</div>` : '';
}
// `bare`: the caller already has the box around the list, so a school with one kind gets the plain options.
export function periodFolders(A, codes, { wrap, option, selected = [], count = () => 0, bare = false }) {
  const groups = periodGroups(A, codes), chosen = new Set(selected.map(String));
  if (!groups[0].period) return bare ? codes.map(option).join('') : `<div class="${wrap}">${codes.map(option).join('')}</div>`;
  return `<div class="range-folders">${groups.map(group => {
    const words = group.codes.reduce((n, code) => n + count(code), 0), open = group.period === 'final' || group.codes.some(code => chosen.has(String(code)));
    return `<details class="range-folder ${group.period}" data-period="${group.period}"${open ? ' open' : ''}><summary><b>${group.label}</b><small>${group.codes.length}개 범위 · ${words}단어</small></summary><div class="${wrap}">${group.codes.map(option).join('')}</div></details>`;
  }).join('')}</div>`;
}
export function getRanges(A, school = A.school, grade = null) {
  const books = A.data.books.filter(book => !grade || !book.grade || book.grade === grade);
  const words = books.flatMap(book => book.words || []);
  const codes = [...new Set(words.map(w => w.range_code))];
  const key = grade ? school + '::' + grade : school;
  // V13.112: while the final exam (기말고사) words are there, a student who has not picked yet starts with those.
  const finalCodes = codes.filter(code => periodOfCode(A, code) === 'final');
  A.ranges[key] ??= (finalCodes.length ? finalCodes : codes).slice(0, 2);
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
    : next ? `${rangeLabel(A.school, next.range_code)} · ${meta.label}`
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
        <span><b>+${num(g.today_xp || 0)}</b><small>오늘 경험치</small></span>
      </div>
      <div class="today-word-next"><span>다음 퀘스트</span><strong>${esc(nextText)}</strong></div>
      <button class="btn primary full today-word-start" data-quick-practice="true"><span>${active ? '하던 연습 이어가기' : daily.target > 0 ? `오늘 ${daily.target}개 시작하기` : '시험범위 확인하기'}</span>${icon('arrow')}</button>
      <button class="today-word-detail" data-study="vocab">시험범위 전체 보기 ${icon('chevron')}</button>
    </section>`;
}
export function rangePicker(A, teacher = false, grade = null) {
  const { words, codes, selected } = getRanges(A, A.school, grade);
  const option = c => {
    const state = !teacher ? wordQuestState(A, c) : null;
    const meta = !teacher ? wordQuestMeta(state) : null;
    return `<label class="range-option ${meta ? 'quest-range ' + meta.cls : ''}"><input type="checkbox" data-range="${c}" ${grade ? `data-range-grade="${esc(grade)}"` : ''} ${selected.includes(c) ? 'checked' : ''} aria-label="${esc(rangeLabel(A.school, c))}"><span>${esc(rangeLabel(A.school, c))}<small>${words.filter(w => w.range_code === c).length}개 단어${meta ? ' · ' + meta.detail : ''}</small>${meta ? `<em class="quest-status ${meta.cls}">${meta.label}</em>` : ''}</span></label>`;
  };
  return `${periodFolders(A, codes, { wrap: teacher ? 'teacher-range' : 'range-grid', option, selected, count: c => words.filter(w => w.range_code === c).length })}<div class="scope-tools"><span id="scope-count">${selected.length}개 범위 · ${selectedCount(A, grade)}개 단어</span><div><button data-range-all="true">전체 선택</button><button data-range-all="false">해제</button></div></div>`;
}
function grammarPassagesForSchool(A) {
  return Array.isArray(A.grammarData?.passages) ? A.grammarData.passages : [];
}
// Mock-exam passages are numbered ("24" -> "24번"); textbook ones already read "1과 · 본문 1".
const passageNumberLabel = passage => /과/.test(String(passage.number)) ? String(passage.number) : `${passage.number}번`;
function grammarExamLabel(passage) {
  return passage.id.startsWith('danwon-ybm2') ? `공통영어2 YBM(김은형) · ${passage.lesson}과`
    : passage.id.startsWith('middle-dong-a-yoon') ? '중3 동아(윤정미) · 본문 Part 4'
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
  const supported = A.data.profile.division === 'middle' || ['단원고','선부고','강서고'].includes(school);
  if (!supported) return '';
  const passages = grammarPassagesForSchool(A);
  if (!passages.length) {
    const completed = Object.values(A.data.grammar_progress || {}).filter(item => item?.mastered).length;
    return `<div class="section-title"><h2>오늘의 시험대비</h2><span class="tiny muted">${completed ? completed + ' MASTER' : '어법·어휘'}</span></div>
      <button class="exam-row exam-range-row" data-study="grammar">
        <span class="square-icon">${icon('records')}</span>
        <div class="grow"><h3>${esc(school)} · 어법·어휘</h3><p>필요할 때만 자료를 불러와 빠르게 학습해요.</p></div>
        ${icon('chevron')}
      </button>`;
  }
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
      <div class="grow"><h3>${esc(school)} · ${esc(passageNumberLabel(target))}</h3><p>${esc(grammarExamLabel(target))} · ${esc(detail)}</p></div>
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
    { key: 'first100', label: '첫 100점', detail: '처음으로 100점을 달성했어요', earned: first100, icon: 'sparkle', art: 'badge-first100' },
    { key: 'streak90', label: '3회 연속 90점+', detail: '세 번 연속 90점 이상', earned: streak90, icon: 'flame', art: 'badge-streak90' },
    { key: 'english100', label: '영어쓰기 100점', detail: '영어 직접 쓰기 만점', earned: english100, icon: 'records', art: 'badge-english100' }
  ];
  const mastered = Object.values(A.data.word_mastery?.ranges || {}).filter(state => ['master','perfect'].includes(state.status)).sort((a,b) => String(a.range_code).localeCompare(String(b.range_code), 'ko', { numeric: true }));
  for (const state of mastered) badges.push({ key: 'master-' + state.range_code, label: `${A.data.profile.division === 'middle' ? state.range_code + '과' : rangeLabel(A.school, state.range_code)} MASTER`, detail: state.status === 'perfect' ? '정답률 100% 완전 정복' : '최근 성취 95% 이상', earned: true, icon: 'check', art: 'badge-master' });
  return badges;
}
function achievementSection(A, full = false) {
  const badges = achievementBadges(A);
  const visible = full ? badges : [...badges.filter(item => item.earned), ...badges.filter(item => !item.earned)].slice(0, 4);
  const earned = badges.filter(item => item.earned).length;
  return `<div class="section-title"><h2>성취 배지</h2>${full ? `<span class="tiny muted">${earned}개 달성</span>` : '<button class="text-button" data-go="records">전체 보기 ' + icon('chevron') + '</button>'}</div><div class="achievement-grid">${visible.map(item => `<div class="achievement-badge ${item.earned ? 'earned' : 'locked'}"><span>${item.earned ? artOr(item.art, icon(item.icon), 'badge-art') : icon('lock')}</span><div><b>${esc(item.label)}</b><small>${esc(item.earned ? item.detail : '아직 도전 중')}</small></div></div>`).join('')}</div>`;
}
// Progress bar inside the home button, e.g. "8/20".
function homeProgress(done, goal, label) {
  const total = Math.max(1, Number(goal) || 1);
  const value = Math.min(total, Math.max(0, Number(done) || 0));
  return `<span class="home-next-progress-v1363" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}" aria-label="${esc(label)} ${value}/${total}"><i><span style="width:${Math.round(value / total * 100)}%"></span></i><b>${value}/${total}</b></span>`;
}
// V13.68: the home no longer recommends study; it only offers to finish a practice left open.
function resumeBar(A) {
  const active = A.data.active_practice_summary || null;
  if (!active) return '';
  const ranges = (active.range_codes || []).map(code => recordRangeLabel({ division: active.division, school: active.school }, code)).join(' · ') || '선택 범위';
  return `<button type="button" class="home-resume-v1368" data-quick-practice="true"><span><small>${active.run_mode === 'test' ? '진행 중인 실전' : '진행 중인 연습'}</small><strong>이어서 마무리해요</strong><em>${esc(ranges)} · ${esc(PRACTICE_TYPES[active.mode] || '단어 학습')}</em>${homeProgress(active.score_total, active.target, '진행')}</span><b>이어서 풀기 ${icon('arrow')}</b></button>`;
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
// Sparkles and corner gems for the higher tiers (drawn in CSS, v1378.css).
function cardFx(tier) {
  const stars = [0, 0, 0, 0, 5, 6, 8, 9, 12, 14][tier.index];
  const gems = tier.key === 'lgd' ? '<i class="card-gem g1"></i><i class="card-gem g2"></i><i class="card-gem g3"></i><i class="card-gem g4"></i>' : '';
  const crown = tier.max ? '<i class="card-crown">MAX</i>' : '';
  return stars || gems ? `<span class="card-fx" aria-hidden="true">${Array.from({ length: stars }, (_, i) => `<i class="card-star" style="--x:${(i * 37 + 11) % 88 + 4}%;--y:${(i * 53 + 7) % 46 + 6}%;--d:${(i * 0.37 % 2.6).toFixed(2)}s;--s:${0.7 + (i * 29 % 7) / 10}"></i>`).join('')}${gems}${crown}</span>` : '';
}
// Home hero: the partner pet as a trading card. The card's finish follows the pet's growth
// (baby plain, growing silver, final holo); tapping flips it to the yacha record.
function partnerCard(A) {
  const p = A.data.profile, g = A.data.stats;
  const partner = g.pet || { key: p.avatar_key, name: '', level: Number(g.level || 1), form: petForm(g.level), percent: g.percent, remaining: g.remaining, xp: g.points };
  const key = petKey(partner.key);
  const pet = CHARACTERS[key];
  const level = Number(partner.level || 1);
  const form = Math.max(0, Math.min(3, Number(partner.form || 0)));
  const percent = Math.max(3, Math.min(100, Number(partner.percent || 0)));
  const hatched = form > 0;
  const nextLine = form === 3 ? '최종 진화 완료' : form === 0 ? `Lv.${PET_FORM_LEVELS[1]}에 태어나요` : `다음 진화 Lv.${PET_FORM_LEVELS[form + 1]}`;
  const owned = Math.max(1, (g.pets || []).length);
  const total = ACTIVE_PET_KEYS.length;
  const number = String(ACTIVE_PET_KEYS.indexOf(key) + 1).padStart(3, '0');
  const battle = g.battle || {};
  const t = titleState(A), have = new Set(t.unlocked);
  // Back of the card: the yacha titles held (and the ones still to win).
  const yachaTitles = TITLE_KEYS.filter(key => TITLES[key].group === 'yacha').filter(key => have.has(key)).slice(-4);
  const titles = yachaTitles.length ? yachaTitles.map(key => titleBadge(key, { size: 'xs' })).join('') : '<span class="partner-titles-empty">야차전 칭호에 도전해요</span>';
  const league = A.data.league;
  // V13.78: the card's rarity follows the pet's level (C .. LGD).
  const tier = cardTier(level);
  return `<section class="partner-card-v1358 tier-${tier.key}${tier.max ? ' tier-max' : ''}" data-card-tier="${tier.key}" style="--pet:${pet.color};--pet-light:${pet.light};--pet-soft:${pet.soft}" aria-label="나의 파트너 카드">
    <button type="button" class="partner-card-btn" data-action="partner-flip" aria-pressed="false" aria-label="파트너 카드. 펫을 누르면 반응하고, 다른 곳을 누르면 뒷면의 야차전 기록을 보여줘요">
      <span class="partner-card">
        <span class="partner-face partner-front">
          <span class="partner-inner">
            <span class="partner-head"><span class="partner-stage">${PET_FORMS[form]}</span><span class="partner-name">${hatched ? esc(petDisplayName(partner)) : '???'}</span>${hatched && !partner.name ? '<span class="partner-name-pen" data-action="pet-name" aria-hidden="true">✎ 이름</span>' : ''}<span class="partner-lv"><small>Lv.</small><b>${level}</b></span></span>
            <span class="partner-art">${avatar(partner.key, { accessory: p.avatar_accessory, frame: p.avatar_frame, form, size: 'home-featured' })}${RUN_SHEETS.has(`${key}-${form}`) ? `<img class="pet-run-preload" src="/assets/pets/${key}-${form}-run.webp" alt="" aria-hidden="true" decoding="async">` : ''}</span>
            <span class="partner-title-v1366">${titleBadge(t.equipped, { size: 'sm' })}</span>
            <span class="partner-skills">
              <span class="partner-skill"><i>단</i><span>단어 공격<small>이번 주 맞힌 단어</small></span><b>${num(g.week_correct || 0)}개</b></span>
              <span class="partner-skill"><i>연</i><span>연속 학습<small>쉬지 않고 공부한 날</small></span><b>${Number(g.streak || 0)}일</b></span>
            </span>
            <span class="partner-evo"><span class="partner-evo-row"><span>${nextLine}</span><span>${form === 3 ? `경험치 ${num(partner.xp || 0)}` : `경험치 ${num(partner.remaining || 0)} 남음`}</span></span><span class="partner-bar" aria-label="레벨 진행률 ${Math.round(Number(partner.percent || 0))}%"><i style="width:${percent}%"></i></span></span>
            <span class="partner-foot"><span class="partner-stars" aria-label="모은 펫 ${owned}/${total}"><b aria-hidden="true">★</b>${owned}<small>/${total}</small></span><span>No.${number} · SUMUS<b class="card-rarity rarity-${tier.key}" title="${tier.name}">${tier.label}</b></span></span>
          </span>
          <span class="partner-sheen" aria-hidden="true"></span>
          ${cardFx(tier)}
        </span>
        <span class="partner-face partner-back">
          <span class="partner-back-in">
            <span class="partner-back-title">야차전 기록</span>
            <span class="partner-rec"><span><b>${num(battle.wins || 0)}</b>승</span><span><b>${num(battle.losses || 0)}</b>패</span><span><b>${num(battle.draws || 0)}</b>무</span></span>
            ${league?.tier ? `<span class="partner-league-v1366">${tierEmblem(league.tier.key, { size: 'sm' })}<span><b>${esc(league.tier.name)}</b> · 이번 주 ${num(league.points)}점${league.rank ? ` · ${league.rank}위` : ''}</span></span>` : ''}
            <span class="partner-streak"><span>${Number(battle.streak || 0) >= 1 ? `지금 ${battle.streak}연승 중` : '연승에 도전해요'}</span><b>최고 ${Number(battle.best_streak || 0)}연승</b></span>
            <span class="partner-titles">${titles}</span>
            <span class="partner-back-hint">다시 누르면 앞면으로</span>
          </span>
        </span>
      </span>
    </button>
    ${petCareBar(A, hatched)}
    <div class="partner-tools">
      <button type="button" data-go="studio">${icon('user')}내 펫 ${owned}/${total}</button>
      <button type="button" class="partner-titles-btn" data-go="titles" aria-label="칭호 도감 ${titleCount(A)}">${icon('star')}칭호 ${titleCount(A)}${(t.fresh || []).length ? '<i class="partner-new" aria-label="새 칭호">N</i>' : ''}</button>
      <button type="button" class="partner-shop" data-action="egg-shop" aria-label="알 상점 열기, 가진 코인 ${num(g.points_balance ?? 0)}개">알 상점</button>
    </div>
  </section>`;
}
// V13.76 펫 교감: once a day each, 쓰다듬기 and 밥 주기 give a little 경험치 and the pet reacts.
// V13.90: for every pet — a student with several pets switches partner to care for the next one.
function petCareBar(A, hatched) {
  const care = A.data.care;
  if (!care) return '';
  const active = A.data.stats?.pet?.key, mine = care.done ? care.done[active] || {} : care;
  const pets = A.data.stats?.pets || [];
  const cared = pets.filter(x => care.done?.[x.key]?.pet && care.done[x.key].feed).length;
  const more = pets.length > 1 ? `<button type="button" class="pet-care-more-v1390 ${cared >= pets.length ? 'all' : ''}" data-go="studio"><span>${cared >= pets.length ? `오늘 펫 ${pets.length}마리를 모두 돌봤어요 ✓` : `오늘 돌본 펫 <b>${cared}/${pets.length}</b> · 파트너를 바꾸면 다른 펫도 돌봐줄 수 있어요`}</span>${icon('arrow')}</button>` : '';
  const item = (kind, label, art) => {
    const done = !!mine[kind];
    return `<button type="button" class="pet-care-btn ${done ? 'done' : ''}" data-pet-care="${kind}" ${done ? 'aria-disabled="true"' : ''} aria-label="${label}${done ? ', 오늘 완료' : `, 경험치 ${care.xp?.[kind] || 10}`}"><span class="pet-care-emoji" aria-hidden="true">${uiArt(art)}</span><span class="pet-care-label">${label}</span><small>${done ? '오늘 완료 ✓' : `경험치 +${care.xp?.[kind] || 10}`}</small></button>`;
  };
  return `<div class="pet-care-v1376" role="group" aria-label="오늘의 펫 교감">${item('pet', hatched ? '쓰다듬기' : '알 쓰다듬기', 'care-pet')}${item('feed', hatched ? '밥 주기' : '알 데워주기', hatched ? 'care-feed' : 'care-warm')}</div>${more}`;
}
// V13.60 home: card, next-step button, a big yacha banner and the week, spaced as one
// column. Word study, exams, the ranking and records stay in the bottom menu.
// Challenges and tournament matches waiting on the student (the everyday way in is the 야차전 tab).
function yachaAlerts(A) {
  const invite = A.data.battle_invite;
  // V13.61: a challenge from a friend replaces the banner until it is answered or expires.
  if (invite && invite.expires_at > Date.now()) {
    const left = Math.max(1, Math.ceil((invite.expires_at - Date.now()) / 60000));
    // V13.66: the opponent of a tournament match opened the room.
    if (invite.tournament) return `<section class="home-yacha-v1360 invite tourney-v1366" aria-label="대회 경기">
      <span class="hy-mark hy-trophy" aria-hidden="true">${trophy('sm')}</span>
      <span class="hy-text"><small>${esc(invite.tournament.name)} · ${esc(invite.tournament.round)}</small><strong>${esc(invite.host)} 입장 완료!</strong><em>판돈 없는 대회 경기 · ${left}분 안에 들어가요</em></span>
      <span class="hy-actions"><button type="button" class="hy-no" data-action="battle-decline" data-id="${esc(invite.id)}">나중에</button><button type="button" class="hy-go" data-action="battle-accept">입장하기 ${icon('arrow')}</button></span>
    </section>`;
    return `<section class="home-yacha-v1360 invite" aria-label="도전장">
      <span class="hy-mark" aria-hidden="true">夜</span>
      <span class="hy-text"><small>도전장이 왔어요!</small><strong>${esc(invite.host)}의 도전</strong><em>판돈 ${num(invite.stake)}코인 · ${left}분 안에 받아요</em></span>
      <span class="hy-actions"><button type="button" class="hy-no" data-action="battle-decline" data-id="${esc(invite.id)}">거절</button><button type="button" class="hy-go" data-action="battle-accept">도전 받기 ${icon('arrow')}</button></span>
    </section>`;
  }
  // V13.66: a tournament match waiting to be played sits on top of the everyday banner.
  const tourney = (A.data.tournaments || []).find(t => t.status === 'active' && t.me?.match?.ready);
  const m = tourney?.me.match;
  const tourneyBanner = tourney ? `<section class="home-yacha-v1360 tourney-v1366" aria-label="대회 경기">
      <span class="hy-mark hy-trophy" aria-hidden="true">${trophy('sm')}</span>
      <span class="hy-text"><small>${esc(tourney.name)}</small><strong>${esc(m.round)} 경기 차례!</strong><em>vs ${esc(m.opponent?.name || '')} · 판돈 없는 대회 경기${m.draws ? ' · 재경기' : ''}</em></span>
      <span class="hy-actions one"><button type="button" class="hy-go" data-action="tournament-play" data-tournament="${esc(tourney.id)}" data-match="${esc(m.id)}">${m.room?.host ? '대기실로 가기' : '경기 시작'} ${icon('arrow')}</button></span>
    </section>` : '';
  return tourneyBanner;
}
// V13.67 daily attendance: a card of seven stamps; the 7th gives the most coins and a capsule
// ticket.
const STAMP_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';
function attendanceCard(A) {
  const a = A.data.rewards?.attendance;
  if (!a) return '';
  const last = ATTENDANCE_REWARDS.length - 1;
  const stamps = ATTENDANCE_REWARDS.map((coins, i) => {
    const on = i < a.stamps, next = !a.done && i === a.stamps;
    return `<li class="${on ? 'on' : ''}${next ? ' next' : ''}${i === last ? ' gift' : ''}"><span>${on ? STAMP_CHECK : i === last ? uiArt('gift', 'att-gift-art') : `<b>${i + 1}</b>`}</span><small>${coins}</small></li>`;
  }).join('');
  const lead = a.done
    ? `<small>출석 완료</small><strong>내일 출석하면 ${coin()}${a.next}</strong>`
    : `<small>출석 체크 · ${a.stamps + 1}번째 도장</small><strong>오늘 출석하고 ${coin()}${a.next} 받기</strong>`;
  return `<section class="att-card${a.done ? ' done' : ''}" aria-label="출석 체크">
    <div class="att-head">${uiArt('attendance', 'att-art')}<div>${lead}</div>${a.done ? `<span class="att-streak">${a.streak >= 2 ? `${a.streak}일 연속` : '오늘 도장 쾅!'}</span>` : '<button type="button" class="btn primary att-btn" data-action="attend">출석하기</button>'}</div>
    <ol class="att-stamps">${stamps}</ol>
    ${a.done ? '' : `<p class="att-foot">7번째 도장은 <b>${coin()}${ATTENDANCE_REWARDS[last]}</b> + <b>뽑기권 ${ATTENDANCE_TICKETS}장</b>! 하루에 한 번 찍어요.</p>`}
  </section>`;
}
// V13.68: this week's ranking of my grade on the home (the whole ranking opens from it).
function rankingCard(A) {
  const rows = A.data.ranking || [];
  const me = rows.find(r => r.is_me);
  if (!me) return '';
  const grade = me.grade;
  const items = rows.filter(r => r.grade === grade).sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
  const rankNo = item => Number(item.xp || 0) > 0 ? items.findIndex(x => Number(x.xp || 0) === Number(item.xp || 0)) + 1 : null;
  const top = items.filter(r => Number(r.xp || 0) > 0).slice(0, 3);
  const mine = rankNo(me);
  return `<button type="button" class="home-rank-v1368" data-go="ranking" aria-label="이번 주 ${esc(grade)} 랭킹 보기">
    <span class="hr-head"><small>이번 주 랭킹 · ${esc(grade)} 경험치</small><strong>${mine ? `나는 <b>${mine}위</b>` : '이번 주 첫 학습으로 순위에 올라요'}</strong>${icon('chevron')}</span>
    ${top.length ? `<span class="hr-top">${top.map((r, i) => `<span class="hr-row${r.is_me ? ' me' : ''}"><i class="hr-medal m${i + 1}">${rankNo(r)}</i>${avatar(r.avatar_key, { size: 'mini', form: r.private ? 1 : Math.max(1, r.pet_form ?? 1) })}<b>${esc(r.display_name)}</b><em>${num(r.xp || 0)}</em></span>`).join('')}</span>` : ''}
  </button>`;
}
// V13.68 home: the pet card, what is waiting (a challenge, a tournament match, a practice left
// open), today's attendance, this week's ranking and the week. Study, yacha and the arcade
// have their own tabs.
function compactGrowth(A) {
  const g = A.data.stats;
  const week = homeWeek(A);
  return `<div class="home-stack-v1360">${partnerCard(A)}
  ${yachaAlerts(A)}
  ${resumeBar(A)}
  ${attendanceCard(A)}
  ${rankingCard(A)}
  <section class="home-week-card home-week-v1358" aria-label="이번 주 출석">
    <span>이번 주 <b>${week.filter(day => day.active).length}일</b> · 오늘 <b>+${num(g.today_xp || 0)} 경험치</b> · <b class="home-week-coin">${coin()}+${num(g.today_reward_points || 0)}</b></span>
    <div class="home-week-days">${week.map(day => `<i class="${day.active ? 'active' : ''} ${day.current ? 'today' : ''}" aria-label="${day.label}요일${day.active ? ' 학습함' : ''}">${day.label}</i>`).join('')}</div>
  </section></div>`;
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
  const passages = grammarPassagesForSchool(A);
  if (passages.length) {
    const target = passages.find(p => !savedGrammarProgress(A, p)?.mastered) || passages[0];
    rows.push(`<button class="home-recommend-row" data-action="grammar-choice" data-grammar-id="${esc(target.id)}"><span>${icon('records')}</span><div class="grow"><b>어법·어휘 ${esc(passageNumberLabel(target))}</b><small>${esc(grammarExamLabel(target))} · ${target.sentences.length}문장</small></div>${icon('chevron')}</button>`);
  }
  return rows.length ? `<div class="section-title"><h2>추천 학습</h2></div><div class="home-recommend-list">${rows.join('')}</div>` : '';
}
function home(A) {
  const p = A.data.profile;
  return `<div class="home-context home-context-v1327"><div><span>SUMUS VOCA</span><b>${esc(p.school || A.school || '학교 미설정')} · ${esc(p.class_name || '')}</b></div></div>
    ${noticeBanner(A)}${legendBanner(A)}${pushPrompt(A)}
    ${compactGrowth(A)}`;
}
// V13.77 선생님 공지 (shown for a few days, until the student closes it) and 알림.
function noticeBanner(A) {
  const n = A.data.notice;
  if (!n) return '';
  let closed = false;
  try { closed = localStorage.getItem('sumus:notice-closed') === n.id; } catch {}
  if (closed) return '';
  return `<section class="notice-v1377" role="status"><span class="notice-mark" aria-hidden="true">${uiArt('notice')}</span><div><small>${esc(n.from_name)}${n.class_name ? ` · ${esc(n.class_name)}` : ''} · ${date(n.at)}</small><p>${esc(n.text)}</p></div><button type="button" class="notice-close" data-action="notice-close" data-id="${esc(n.id)}" aria-label="공지 닫기">×</button></section>`;
}
// V13.89 전설 소식: a separate gold banner for two days, so it never hides 선생님 공지.
function legendBanner(A) {
  const n = A.data.legend_news;
  if (!n) return '';
  let closed = false;
  try { closed = localStorage.getItem('sumus:legend-closed') === n.id; } catch {}
  if (closed) return '';
  return `<section class="legend-news-v1389" role="status"><img src="/assets/lucky/legend-badge.webp" alt="" aria-hidden="true"><div><small>전설 소식 · ${date(n.at)}</small><p>${esc(n.text)}</p></div><button type="button" class="notice-close" data-action="legend-close" data-id="${esc(n.id)}" aria-label="전설 소식 닫기">×</button></section>`;
}
export const pushSupport = () => {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const installed = matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const api = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { ios, installed, api, needsInstall: ios && !installed, blocked: api && Notification.permission === 'denied' };
};
function pushPrompt(A) {
  const s = pushSupport();
  if (A.pushHere !== false || !s.api || s.blocked || s.needsInstall) return '';
  try { if (Number(localStorage.getItem('sumus:push-later') || 0) > Date.now()) return ''; } catch {}
  return `<section class="push-prompt-v1377"><span class="push-bell" aria-hidden="true">${uiArt('bell')}</span><div><b>알림 켜기</b><small>선생님 공지·도전장·선물을 바로 알려 줄게요</small></div><button type="button" class="btn primary small" data-action="push-on">켜기</button><button type="button" class="push-later" data-action="push-later" aria-label="나중에">나중에</button></section>`;
}
// V13.91 an empty list with its drawn picture (asset list 08-8) once it is in ART_READY.
const emptyArt = (art, name, title, sub = '') => `<div class="empty-state">${artOr(art, icon(name), 'empty-art')}<h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
// V13.91 나 메뉴판: everything else the student can open, as one grid of app-style icons.
function meMenu(A, { gachaHave, att }) {
  const s = pushSupport(), stars = (A.memStars || []).length;
  const item = (attrs, art, label, note = '') => `<button type="button" class="me-menu-item" ${attrs}><span class="me-menu-art">${art}</span><b>${label}</b>${note ? `<small>${note}</small>` : ''}</button>`;
  const items = [
    item('data-go="records"', artOr('me-records', icon('records')), '내 기록'),
    att.done ? item('data-go="home"', artOr('me-attendance', uiArt('attendance')), '출석 도장', att.streak >= 2 ? `${att.streak}일 연속` : '오늘 완료') : item('data-action="attend"', artOr('me-attendance', uiArt('attendance')), '출석 도장', '<i class="me-menu-dot">오늘 아직</i>'),
    item('data-action="me-stars"', artOr('me-stars', uiArt('star-word')), '어려운 단어', stars ? `★ ${num(stars)}개` : ''),
    item('data-action="me-notify"', artOr('me-notify', uiArt('bell')), '알림', A.pushHere ? '켜짐' : '꺼짐'),
    gachaHave ? item('data-go="gachabook"', artOr('me-gacha', icon('arcade')), '모은 꾸미기', `${gachaHave}개`) : '',
    !s.installed ? `<a class="me-menu-item" href="/install"><span class="me-menu-art">${artOr('me-install', uiArt('install'))}</span><b>앱 설치</b></a>` : '',
    item('data-action="account"', artOr('me-settings', icon('shield')), '계정·설정')
  ].filter(Boolean);
  return `<section class="me-menu-v1391" aria-label="메뉴"><h2>메뉴</h2><div class="me-menu-grid">${items.join('')}</div></section>`;
}
function meNotify(A) {
  const s = pushSupport(), push = A.data.push || {};
  const here = A.pushHere === true;
  let body;
  if (s.needsInstall) body = `<p>아이폰은 <b>홈 화면에 추가한 앱</b>에서만 알림을 받을 수 있어요.</p><a class="btn primary full" href="/install">📲 앱으로 설치하는 방법</a>`;
  else if (!s.api) body = '<p>이 브라우저는 알림을 지원하지 않아요. 크롬(안드로이드)이나 사파리(아이폰)로 설치해 주세요.</p>';
  else if (s.blocked) body = '<p>알림이 <b>차단</b>돼 있어요. 휴대폰 <b>설정 → 알림</b>에서 SUMUS(또는 브라우저)를 허용한 뒤 다시 눌러 주세요.</p><button type="button" class="btn full" data-action="push-on">다시 확인</button>';
  else if (here) body = `<p class="push-on-line">🔔 이 휴대폰으로 알림을 받고 있어요.</p>
    <label class="push-row"><span><b>저녁 7시 공부 알림</b><small>오늘 공부를 안 했으면 한 번 알려 줘요</small></span><input type="checkbox" class="switch" data-push-daily ${push.daily !== false ? 'checked' : ''}></label>
    <button type="button" class="text-button" data-action="push-off">이 휴대폰 알림 끄기</button>`;
  else body = `<p>선생님 공지, 친구의 도전장, 선물, 저녁 공부 알림을 받아요.</p><button type="button" class="btn primary full" data-action="push-on">🔔 알림 켜기</button>`;
  return `<section class="me-notify-v1377" id="me-notify" aria-label="알림"><h2>알림</h2>${body}</section>`;
}
// V13.76 ⭐ 어려운 단어: the starred words of this school and grade, practised together.
export function starredWords(A) {
  const stars = new Set(A.memStars || []);
  if (!stars.size) return [];
  const seen = new Set();
  return (A.data.books || []).flatMap(book => book.words || []).filter(word => stars.has(word.id) && !seen.has(word.id) && seen.add(word.id));
}
function starPracticeButton(A, cls = '') {
  // One practice takes up to 200 words (the server's limit).
  const n = Math.min(200, starredWords(A).length);
  if (!n) return '';
  return `<button type="button" class="star-practice-v1376 ${cls}" data-star-practice="true"><span class="star-practice-mark" aria-hidden="true">${uiArt('star-word')}</span><span><small>어려운 단어 모음</small><strong>★ ${n}개 모아서 연습</strong></span><b>${icon('arrow')}</b></button>`;
}
function studyHub(A) {
  return `<div class="page-heading study-simple-heading premium-page-heading"><span class="premium-eyebrow">LEARNING</span><h1>학습</h1></div>
  ${studyDailyCard(A)}
  <div class="study-hub-grid study-hub-simple">
    <button class="study-hub-card vocab" data-study="vocab">
      <span class="study-hub-icon">${artOr('study-vocab', icon('practice'), 'hub-art')}</span>
      <div><span class="pill green">VOCAB</span><h2>단어 학습</h2></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>
    <button class="study-hub-card grammar" data-study="grammar">
      <span class="study-hub-icon">${artOr('study-grammar', icon('records'), 'hub-art')}</span>
      <div><span class="pill">GRAMMAR</span><h2>어법·어휘</h2></div>
      <span class="study-hub-arrow">${icon('arrow')}</span>
    </button>
  </div>
  ${starPracticeButton(A, 'in-hub')}`;
}
// V13.107: the passage number as a two-line tile ("1과 본문" over a big "1"; a mock-exam item
// shows "No." over its number), the title, then small chips for sentences and state.
function grammarTile(number) {
  const text = String(number || '');
  const lesson = text.match(/^(.+?)\s*·\s*본문\s*(.+)$/);
  if (lesson) return { top: `${lesson[1]} 본문`, main: lesson[2] };
  if (/^[\d~\-\s]+$/.test(text)) return { top: 'No.', main: text.replace(/\s+/g, '') };
  return { top: '', main: text };
}
function grammarCards(A, passages) {
  return passages.map(p => {
    const saved = savedGrammarProgress(A, p);
    const mastered = Boolean(saved?.mastered);
    const tile = grammarTile(p.number);
    return `<button class="grammar-set-card premium gx-card ${mastered ? 'mastered' : ''}" data-action="grammar-choice" data-grammar-id="${esc(p.id)}" aria-label="${esc(p.number)} ${esc(p.subtitle)} ${mastered ? '다시 보기' : '시작하기'}">
      <span class="gx-tile${tile.main.length > 3 ? ' long' : ''}">${tile.top ? `<small>${esc(tile.top)}</small>` : ''}<b>${esc(tile.main)}</b></span>
      <span class="gx-body">
        <b class="gx-title">${esc(p.subtitle)}</b>
        <span class="gx-meta"><span class="gx-chip">${p.sentences.length}문장</span><span class="gx-chip state ${mastered ? 'master' : ''}">${mastered ? 'MASTER' : '어법 선택형'}</span></span>
      </span>
      <span class="gx-go" aria-hidden="true">${mastered ? icon('check') : icon('arrow')}</span>
    </button>`;
  }).join('');
}

function grammarStudy(A) {
  const school = A.data.profile.school || A.school || '';
  const middle = A.data.profile.division === 'middle';
  const data = A.grammarData;
  if (!data) return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill green">GRAMMAR</span></div><section class="grammar-empty-school"><div><b>어법 자료를 불러오고 있어요.</b><p>잠시만 기다려주세요.</p></div></section>`;
  const isDanwon = school === '단원고';
  const isSeonbu = school === '선부고';
  const isGangseo = school === '강서고';
  const passages = data.passages || [];
  const current = data.current || [];
  const old = data.old || [];
  const byLesson = data.byLesson || {};

  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill green">GRAMMAR</span></div>
  <div class="page-heading grammar-heading"><h1>어법·어휘</h1></div>
  <section class="study-school-card locked"><div><span class="tiny muted">현재 학교</span><strong>${esc(school)}</strong></div><span class="school-fixed">${icon('shield')} 선생님 관리</span></section>
  ${middle ? (() => {
    const lesson = Number(A.middleGrammarLesson || 6);
    const selectedLesson = [6,7].includes(lesson) ? lesson : 6;
    const lessonPassages = byLesson[selectedLesson] || [];
    const completed = lessonPassages.filter(p => savedGrammarProgress(A, p)?.mastered).length;
    return `
      <section class="grammar-range-head middle compact-v1339"><div><span class="eyebrow">중3 · 동아(윤정미)</span><h2>교과서 본문 어법 선택형</h2><p>문장을 읽고 알맞은 어법을 선택해요.</p></div></section>
      <div class="middle-grammar-tabs-v1339">
        ${[6,7].map(n => {
          const ps = byLesson[n] || [];
          const done = ps.filter(p => savedGrammarProgress(A,p)?.mastered).length;
          return `<button data-middle-grammar-lesson="${n}" class="${selectedLesson === n ? 'selected' : ''}"><b>${n}과</b><small>${done}/${ps.length} 완료</small></button>`;
        }).join('')}
      </div>
      <div class="middle-grammar-summary-v1339"><b>${selectedLesson}과</b><span>${lessonPassages.length}개 본문 · ${completed}개 완료</span></div>
      <div class="grammar-set-list compact-v1339">${grammarCards(A, lessonPassages)}</div>
    `;
  })() : isDanwon ? `
    ${[1, 2].filter(n => (byLesson[n] || []).length).map(n => `
      <section class="grammar-range-head"><div><span class="eyebrow">단원고 시험범위 · 교과서</span><h2>공통영어2 YBM(김은형) ${n}과</h2></div><span class="grammar-range-count">${byLesson[n].length}지문</span></section>
      <div class="grammar-set-list">${grammarCards(A, byLesson[n])}</div>
    `).join('')}
    ${(data.mock || passages).length && (data.textbook || []).length ? '<div class="grammar-year-divider"><span>모의고사 범위</span></div>' : ''}
    <section class="grammar-range-head"><div><span class="eyebrow">단원고 시험범위</span><h2>2025년 9월 인천교육청</h2></div><span class="grammar-range-count">${(data.mock || passages).length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, data.mock || passages)}</div>
  ` : isGangseo ? `
    ${[1, 2].filter(n => (byLesson[n] || []).length).map(n => `
      <section class="grammar-range-head"><div><span class="eyebrow">강서고 시험범위 · 교과서</span><h2>공통영어2 YBM(김은형) ${n}과</h2></div><span class="grammar-range-count">${byLesson[n].length}지문</span></section>
      <div class="grammar-set-list">${grammarCards(A, byLesson[n])}</div>
    `).join('')}
    ${(data.textbook || []).length ? '<div class="grammar-year-divider"><span>모의고사 범위</span></div>' : ''}
    <section class="grammar-range-head gangseo"><div><span class="eyebrow">강서고 시험범위 · 2026</span><h2>2026년 6월 부산교육청</h2></div><span class="grammar-range-count">${(data.mock || passages).length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, data.mock || passages)}</div>
  ` : isSeonbu ? `
    <section class="grammar-range-head seonbu current"><div><span class="eyebrow">선부고 시험범위 · 2026</span><h2>2026년 3월 서울교육청</h2></div><span class="grammar-range-count">${current.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, current)}</div>
    <div class="grammar-year-divider"><span>2025년 범위</span></div>
    <section class="grammar-range-head seonbu old"><div><span class="eyebrow">선부고 시험범위 · 2025</span><h2>2025년 9월 인천교육청</h2></div><span class="grammar-range-count">${old.length}지문</span></section>
    <div class="grammar-set-list">${grammarCards(A, old)}</div>
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
// V13.124 고등 단어 고르기: 과마다 고른 단어 id (단어 학습 A.highWordIds, 시험 A.highExamWordIds).
// 폰에 저장한다(중학교 middleWordIds와 같은 방식). 처음 여는 과는 앞 20개, 시험은 단어 학습에서 고른 단어를 한 번 복사.
export const HIGH_PICK_DEFAULT = 20, HIGH_PICK_CHUNK = 20, HIGH_EXAM_MAX = 200;
export const HIGH_PICK_STORES = { memo: 'highWordIds', exam: 'highExamWordIds' };
export function highLessonPick(A, scope, code, lessonWords) {
  const store = HIGH_PICK_STORES[scope] || 'highWordIds', key = String(code || '');
  A[store] = A[store] && typeof A[store] === 'object' && !Array.isArray(A[store]) ? A[store] : {};
  if (!key) return [];
  const valid = new Set(lessonWords.map(word => word.id));
  let ids = A[store][key];
  if (!Array.isArray(ids)) {
    const seed = scope === 'exam' ? (A.highWordIds?.[key] || []).filter(id => valid.has(id)) : [];
    ids = seed.length ? [...seed] : lessonWords.slice(0, HIGH_PICK_DEFAULT).map(word => word.id);
  }
  const chosen = new Set(ids.filter(id => valid.has(id)));
  // 목록 순서(번호 순)로 둔다.
  A[store][key] = lessonWords.filter(word => chosen.has(word.id)).map(word => word.id);
  return A[store][key];
}
// 시험 화면 과 칩·요약: 아직 열지 않은 과는 0개(열 때 처음 값이 정해진다).
function highExamPicked(A, code, lessonWords) {
  const ids = A.highExamWordIds?.[String(code)];
  if (!Array.isArray(ids)) return [];
  const chosen = new Set(ids);
  return lessonWords.filter(word => chosen.has(word.id));
}
function highSchoolMemorizeState(A) {
  const { words, codes, selected } = getRanges(A);
  const normalized = codes.map(code => String(code));
  const selectedFirst = selected.map(code => String(code)).find(code => normalized.includes(code));
  if (!normalized.includes(String(A.memorizeRange || ''))) A.memorizeRange = selectedFirst || normalized[0] || '';
  const code = String(A.memorizeRange || '');
  const lessonWords = words.filter(word => String(word.range_code) === code);
  const chosen = new Set(highLessonPick(A, 'memo', code, lessonWords));
  return {
    words,
    codes,
    code,
    lessonWords,
    pickedWords: lessonWords.filter(word => chosen.has(word.id))
  };
}
// V13.124: 고등은 고른 단어만 목록·카드에 나온다(★ 어려운 단어 보기는 그 과의 별표 전체).
function memorizationScope(A) {
  if (A.data.profile.division === 'middle') { const words = middleLessonState(A).lessonWords; return { words, starPool: words }; }
  const state = highSchoolMemorizeState(A);
  return { words: state.pickedWords, starPool: state.lessonWords };
}
// V13.90 the words the cover cards use: what the list shows (the range, or only ★ words).
export function memorizeDeck(A) {
  const middle = A.data.profile.division === 'middle';
  const { words, starPool } = memorizationScope(A);
  const stars = new Set(A.memStars || []);
  const starredOnly = A.memorizeFilter === 'starred';
  const code = middle ? middleLessonState(A).code : String(A.memorizeRange || '');
  const range = middle ? `${code}과` : rangeLabel(A.school, code);
  return { words: starredOnly ? starPool.filter(word => stars.has(word.id)) : words, title: starredOnly ? `${range} ★ 어려운 단어` : middle ? range : `${range} · 고른 단어` };
}
// V13.124 빠른 버튼(1~20 · 21~40 … · 전체)과 접고 펴는 체크 목록(중학교 체크 목록 CSS를 그대로 쓴다).
function highWordPicker(A, { scope, code, lessonWords, ids, open }) {
  const chosen = new Set(ids), n = lessonWords.length;
  const attrs = `data-high-scope="${scope}" data-high-code="${esc(code)}"`;
  const isChunk = (from, to) => ids.length === to - from && lessonWords.slice(from, to).every(word => chosen.has(word.id));
  const chunks = [];
  for (let from = 0; from < n; from += HIGH_PICK_CHUNK) chunks.push([from, Math.min(n, from + HIGH_PICK_CHUNK)]);
  const allOn = n > 0 && ids.length === n;
  const quick = chunks.map(([from, to]) => { const on = !allOn && isChunk(from, to); return `<button type="button" ${attrs} data-high-chunk="${from}" class="${on ? 'selected' : ''}" aria-pressed="${on}">${from + 1}~${to}</button>`; }).join('')
    + `<button type="button" ${attrs} data-high-chunk="all" class="all ${allOn ? 'selected' : ''}" aria-pressed="${allOn}">전체 ${n}</button>`;
  return `<div class="high-pick-v13124" data-scope="${scope}">
    <div class="high-pick-quick-v13124" role="group" aria-label="빠른 선택">${quick}</div>
    <div class="middle-direct-picker-v1343 high-pick-box-v13124">
      <button type="button" class="high-pick-toggle-v13124" data-high-pick-toggle="${scope}" aria-expanded="${open}"><span><strong>직접 고르기</strong><small>번호·단어·뜻을 보고 체크해요</small></span><b>${ids.length}개 선택</b><i aria-hidden="true">${open ? '접기' : '펼치기'}</i></button>
      ${open ? `<div class="middle-direct-actions-v1343"><button type="button" ${attrs} data-high-all="true">전체 선택</button><button type="button" ${attrs} data-high-all="false">전체 해제</button></div>
      <div class="middle-direct-list-v1343 high-pick-list-v13124" data-high-list="${scope}">${lessonWords.map((word, index) => `<label class="middle-direct-word-v1343 ${chosen.has(word.id) ? 'selected' : ''}">
        <input type="checkbox" ${attrs} data-high-word="${esc(word.id)}" ${chosen.has(word.id) ? 'checked' : ''}>
        <span class="middle-direct-check-v1343"></span>
        <span class="middle-direct-number-v1343">${index + 1}</span>
        <span class="middle-direct-copy-v1343"><b>${esc(word.word)}</b><small>${esc(word.meaning)}</small></span>
      </label>`).join('')}</div>` : ''}
    </div>
  </div>`;
}
// V13.90: a big button above the list opens 카드로 가리고 외우기 (flashcards.js).
function flashcardEntry(A, visible) {
  if (!visible.length) return '';
  const known = knownWords(A.data.profile.id), done = visible.filter(word => known.has(word.id)).length;
  const pct = Math.round(done / visible.length * 100);
  return `<button type="button" class="fc-entry-v1390" data-flashcards="true"><span class="fc-entry-art" aria-hidden="true">${artOr('flash-deck', '<i></i><i></i><i></i>')}</span><span class="fc-entry-text"><small>뜻을 가리고 한 장씩</small><strong>카드로 외우기</strong><em>${done ? `외운 단어 ${done}/${visible.length}` : `${visible.length}장 · 커버를 내려서 확인해요`}</em>${done ? `<span class="fc-entry-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}</span><b>${icon('arrow')}</b></button>`;
}
function memorizationPanel(A) {
  const middle = A.data.profile.division === 'middle';
  const stars = new Set(A.memStars || []);
  const revealed = new Set(A.memRevealed || []);
  const starredOnly = A.memorizeFilter === 'starred';
  const known = knownWords(A.data.profile.id);
  const allShown = A.memorizeShowAll === true;
  const rangeUi = middle
    ? (() => {
        const state = middleLessonState(A);
        return `<div class="middle-lesson-tabs setup-choice-row">${state.codes.map(range => { const count = state.words.filter(word => String(word.range_code) === String(range)).length; return `<button data-middle-lesson="${esc(range)}" class="${String(range) === state.code ? 'selected' : ''}">${esc(range)}과 <small>${count}개</small></button>`; }).join('')}</div>`;
      })()
    : (() => {
        const state = highSchoolMemorizeState(A);
        // V13.112: 기말고사 / 중간고사 first, then 모의고사 / 교과서 within it.
        const period = activePeriod(A, state.codes), periodCodes = state.codes.filter(code => inPeriod(A, period, code));
        const textbookCodes = periodCodes.filter(code => /^L\d+$/i.test(String(code)));
        const mockCodes = periodCodes.filter(code => !/^L\d+$/i.test(String(code)));
        const availableTypes = [['mock','모의고사',mockCodes],['textbook','교과서',textbookCodes]].filter(([, , codes]) => codes.length);
        if (!availableTypes.some(([key]) => key === A.memorizeRangeType)) A.memorizeRangeType = textbookCodes.includes(state.code) ? 'textbook' : (availableTypes[0]?.[0] || 'mock');
        const visibleCodes = A.memorizeRangeType === 'textbook' ? textbookCodes : mockCodes;
        if (visibleCodes.length && !visibleCodes.includes(state.code)) A.memorizeRange = String(visibleCodes[0]);
        const activeCode = String(A.memorizeRange || visibleCodes[0] || '');
        const tabs = availableTypes.length > 1 ? `<div class="segment exam-source-tabs memorize-source-tabs">${availableTypes.map(([key,label]) => `<button data-memorize-range-type="${key}" class="${A.memorizeRangeType === key ? 'selected' : ''}">${label}</button>`).join('')}</div>` : '';
        return schoolSwitch(A) + periodTabs(A, state.codes, 'data-memorize-period') + tabs + `<div class="memorize-range-strip" role="tablist" aria-label="학습 범위">${visibleCodes.map(range => {
          const code = String(range);
          const count = state.words.filter(word => String(word.range_code) === code).length;
          const selected = code === activeCode;
          return `<button role="tab" aria-selected="${selected}" data-memorize-range="${esc(code)}" class="${selected ? 'selected' : ''}"><strong>${esc(rangeLabel(A.school, range))}</strong><small>${count}개</small></button>`;
        }).join('')}</div>`;
      })();
  // 과 칩이 과를 바꿀 수 있으니 단어는 그 뒤에 고른다.
  const { words, starPool } = memorizationScope(A);
  const visible = starredOnly ? starPool.filter(word => stars.has(word.id)) : words;
  const starredInScope = starPool.filter(word => stars.has(word.id));
  const pickUi = middle ? '' : (() => {
    const state = highSchoolMemorizeState(A);
    if (!state.lessonWords.length) return '';
    const ids = state.pickedWords.map(word => word.id);
    return `<section class="setup-section high-today-v13124"><div class="step-label"><span>02</span>오늘 외울 단어</div>
      <p class="high-pick-summary-v13124"><b>${esc(rangeLabel(A.school, state.code))}</b> ${state.lessonWords.length}개 중 <strong>${ids.length}개</strong> 선택</p>
      ${highWordPicker(A, { scope: 'memo', code: state.code, lessonWords: state.lessonWords, ids, open: A.highPickOpen === true })}</section>`;
  })();
  return `<div class="study-subhead"><button class="study-back" data-study="hub">${icon('back')} 학습</button><span class="pill green">VOCAB</span></div>
    <div class="page-heading memorize-heading premium-page-heading"><span class="premium-eyebrow">VOCABULARY</span><h1>단어 학습</h1></div>
    <section class="setup-section"><div class="step-label"><span>01</span>범위</div>${rangeUi}</section>
    ${pickUi}
    <section class="memorize-shell">
      <div class="memorize-toolbar">
        <div class="segment compact"><button data-memorize-filter="all" class="${!starredOnly ? 'selected' : ''}">${middle ? '전체' : '고른 단어'} ${words.length}</button><button data-memorize-filter="starred" class="${starredOnly ? 'selected' : ''}">★ 어려운 단어 ${starredInScope.length}</button></div>
        <button class="text-button" data-memorize-reveal-all="${allShown ? 'hide' : 'show'}">${allShown ? '전체 영어 보기' : '전체 뜻 보기'}</button>
      </div>
      ${flashcardEntry(A, visible)}
      ${starPracticeButton(A, 'in-memorize')}
      <div class="memorize-list">${visible.length ? visible.map((word,index) => {
        const show = allShown || revealed.has(word.id);
        const star = stars.has(word.id);
        const front = show ? word.meaning : word.word;
        return `<div class="memorize-row ${show ? 'revealed' : ''} ${star ? 'starred' : ''} ${known.has(word.id) ? 'known-v1390' : ''}">
          <button class="memorize-star" data-memorize-star="${esc(word.id)}" aria-label="${star ? '어려운 단어 해제' : '어려운 단어 표시'}">${star ? '★' : '☆'}</button>
          <button class="memorize-word" data-memorize-word="${esc(word.id)}" aria-label="${esc(word.word)} ${show ? '영어 보기' : '뜻 보기'}"><span class="memorize-no">${index + 1}</span><strong>${esc(front)}</strong></button>
          <button class="memorize-sound" data-memorize-speak="${esc(word.id)}" aria-label="${esc(word.word)} 발음 듣기">${icon('sound')}</button>
        </div>`;
      }).join('') : `<div class="memorize-empty">${artOr('word-empty', '', 'empty-art')}${starredOnly ? '이 범위에 ★ 표시한 단어가 없어요. 헷갈리는 단어의 ☆를 눌러 모아 두세요.' : middle ? '표시할 단어가 없어요. 범위를 선택해주세요.' : '오늘 외울 단어를 위에서 골라 주세요.'}</div>`}</div>
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

// V13.68: 학습 holds word study, tests and records; this bar switches between them.
function studyTabs(A) {
  return `<div class="segment study-tabs-v1368" role="group" aria-label="학습 메뉴">${[['practice', '단어·어법'], ['exam', '시험'], ['records', '기록']].map(([tab, label]) => `<button type="button" data-go="${tab}" class="${A.tab === tab ? 'selected' : ''}" aria-pressed="${A.tab === tab}">${label}</button>`).join('')}</div>`;
}
// V13.71: 오늘의 추천 학습 lives at the top of 학습 (v13.68 took it off the home, which left no
// way to start it). Same button, progress bar (8/20) and finished state as v13.63.
function studyDailyCard(A) {
  const active = A.data.active_practice_summary || null;
  if (active) {
    const ranges = (active.range_codes || []).map(code => recordRangeLabel({ division: active.division, school: active.school }, code)).join(' · ') || '선택 범위';
    return `<button type="button" class="home-next-v1358 study-daily-v1371" data-quick-practice="true"><span><small>${active.daily_quest ? '오늘의 추천 학습' : active.run_mode === 'test' ? '진행 중인 실전' : '진행 중인 연습'}</small><strong>이어서 마무리해요</strong><em>${esc(ranges)} · ${esc(PRACTICE_TYPES[active.mode] || '단어 학습')}</em>${homeProgress(active.score_total, active.target, '진행')}</span><b>이어서 풀기 ${icon('arrow')}</b></button>`;
  }
  const daily = A.data.daily_quest || null;
  if (!(daily?.target > 0)) return '';
  const goal = Number(daily.goal_today || daily.target), done = Number(daily.done_today || 0), mix = daily.mix || {};
  if (daily.completed_today) return `<button type="button" class="home-next-v1358 is-done-v1363 study-daily-v1371" data-quick-practice="true"><span><small>오늘의 추천 학습</small><strong>오늘 목표 달성!</strong><em>더 풀면 새로 필요한 단어를 골라줘요.</em>${homeProgress(goal, goal, '오늘 학습')}</span><b>한 번 더 하기 ${icon('arrow')}</b></button>`;
  return `<button type="button" class="home-next-v1358 study-daily-v1371" data-quick-practice="true">${artOr('study-daily', '', 'daily-art')}<span><small>오늘의 추천 학습</small><strong>${done > 0 ? `오늘 ${goal - done}개 남았어요` : `오늘은 ${daily.target}개만 끝내요`}</strong><em>오답 ${mix.wrong || 0} · 복습 ${mix.review || 0} · 새 단어 ${mix.new || 0}</em>${homeProgress(done, goal, '오늘 학습')}</span><b>${done > 0 ? '오늘 학습 계속' : '오늘 학습 시작'} ${icon('arrow')}</b></button>`;
}
function practice(A) {
  if (A.studyView === 'vocab') return vocabPractice(A);
  if (A.studyView === 'grammar') return grammarStudy(A);
  return `${studyTabs(A)}${studyHub(A)}`;
}
// V13.68 야차전 tab: the lobby is drawn by battle.js inside this box (a match goes full screen).
function yachaPage() {
  return '<div id="yacha-host" class="yacha-host"></div>';
}
// V13.68 나: what the student has collected, and the way to each collection.
const backTo = (tab, label) => `<button type="button" class="page-back-v1368" data-go="${tab}">${icon('back')}${label}</button>`;
// V13.70 my place this week in my grade (경험치), for the 나 ranking tile.
function myRankLine(A) {
  const rows = A.data.ranking || [], me = rows.find(r => r.is_me);
  if (!me || !(Number(me.xp || 0) > 0)) return '이번 주 순위 보기';
  const higher = rows.filter(r => r.grade === me.grade && Number(r.xp || 0) > Number(me.xp || 0)).length;
  // V13.71: say it is the grade rank; the tile opens the ranking on the same grade and week.
  return `${esc(me.grade || '우리 학년')} 이번 주 ${higher + 1}위`;
}
function mePage(A) {
  const p = A.data.profile, g = A.data.stats, pet = g.pet, t = titleState(A);
  const items = A.data.rewards?.gacha?.items || {};
  const gachaHave = Object.keys(GACHA_ITEMS).filter(key => items[key] > 0).length;
  // Decorations from the retired capsule machine: a tile only for students who have some.
  const att = A.data.rewards?.attendance || {}, battle = g.battle || {};
  const owned = (g.pets || []).length;
  return `<div class="page-heading me-head-v1368"><span class="premium-eyebrow">MY SUMUS</span><h1>나</h1></div>
    <section class="me-profile-v1368">
      <span class="me-pet">${pet ? avatar(pet.key, { form: Math.max(1, pet.form), accessory: p.avatar_accessory, frame: p.avatar_frame }) : ''}</span>
      <div class="me-who"><strong>${esc(p.display_name)}</strong><small>${esc(p.school || '')} · ${esc(p.class_name || '')} · Lv.${num(g.level || 1)}</small>${titleBadge(t.equipped, { size: 'sm' })}</div>
    </section>
    <div class="me-tiles-v1368 four">
      <button type="button" class="me-tile pet" data-go="studio"><span class="me-ico">${artOr('me-pets', icon('user'))}</span><b>내 펫·꾸미기</b><small>펫 ${owned}/${ACTIVE_PET_KEYS.length}</small></button>
      <button type="button" class="me-tile rank" data-go="ranking" data-from="me" data-rank-grade="${esc((A.data.ranking || []).find(r => r.is_me)?.grade || '')}"><span class="me-ico">${artOr('me-ranking', icon('ranking'))}</span><b>랭킹</b><small>${myRankLine(A)}</small></button>
      <button type="button" class="me-tile titles" data-go="titles"><span class="me-ico">${artOr('me-titles', icon('star'))}</span><b>칭호 도감</b><small>${titleCount(A)}${(t.fresh || []).length ? ' · <i class="me-new">NEW</i>' : ''}</small></button>
      <button type="button" class="me-tile petbook" data-go="petbook"><span class="me-ico">${artOr('me-petbook', icon('sparkle'))}</span><b>펫 도감</b><small>${owned}/${ACTIVE_PET_KEYS.length}마리</small></button>
    </div>
    ${meMenu(A, { gachaHave, att })}
    <section class="me-stats-v1368" aria-label="내 기록">
      <div><b>${num(g.streak || 0)}<small>일</small></b><span>연속 학습</span></div>
      <div><b>${num(att.total || 0)}<small>번</small></b><span>출석</span></div>
      <div><b>${num(battle.wins || 0)}<small>승</small></b><span>야차전</span></div>
      <div><b>${num(g.best_combo || 0)}</b><span>최고 연속 정답</span></div>
    </section>
    ${meNotify(A)}`;
}
// V13.124 고등 시험: 보이는 과(시험·교과서/모의고사 탭)에서 고른 단어를 합친다. 개수 = 고른 단어 수.
export function highExamSelection(A) {
  const state = getRanges(A);
  const period = activePeriod(A, state.codes), periodCodes = state.codes.filter(code => inPeriod(A, period, code));
  const textbookCodes = periodCodes.filter(code => /^L\d+$/i.test(String(code)));
  const mockCodes = periodCodes.filter(code => !/^L\d+$/i.test(String(code)));
  const availableTypes = [['mock','모의고사',mockCodes],['textbook','교과서',textbookCodes]].filter(([, , codes]) => codes.length);
  if (!availableTypes.some(([key]) => key === A.highRangeType)) A.highRangeType = availableTypes[0]?.[0] || 'mock';
  const visibleCodes = A.highRangeType === 'textbook' ? textbookCodes : mockCodes;
  const lessons = visibleCodes.map(code => {
    const lessonWords = state.words.filter(word => String(word.range_code) === String(code));
    return { code: String(code), lessonWords, picked: highExamPicked(A, code, lessonWords) };
  });
  const parts = lessons.filter(lesson => lesson.picked.length);
  const wordIds = parts.flatMap(lesson => lesson.picked.map(word => word.id));
  return { state, availableTypes, lessons, parts, wordIds };
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
    return `${studyTabs(A)}<div class="page-heading exam-choice-heading premium-page-heading"><span class="premium-eyebrow">TEST</span><h1>시험</h1></div>
      <div class="exam-kind-grid">
        <button class="exam-kind-card practice" data-exam-kind="practice"><span class="square-icon">${artOr('exam-practice', icon('practice'), 'hub-art')}</span><div><span class="pill green">PRACTICE</span><h2>연습시험</h2><p>문제마다 바로 채점</p></div>${icon('arrow')}</button>
        <button class="exam-kind-card test" data-exam-kind="test"><span class="square-icon">${artOr('exam-test', icon('exam'), 'hub-art')}</span><div><span class="pill">TEST</span><h2>실전시험</h2><p>마지막에 한꺼번에 채점</p></div>${icon('arrow')}</button>
      </div>`;
  }
  if (!['write_meaning','spell','eng2mean','mean2eng'].includes(A.mode)) A.mode = 'write_meaning';
  const testMode = A.examKind === 'test';
  A.practiceRunMode = testMode ? 'test' : 'practice';
  const middle = A.data.profile.division === 'middle';
  let scopeUi = '', count = 0, scopeLabel = '', over = false;
  if (middle) {
    const state = middleLessonState(A);
    const selected = new Set(state.selected);
    count = selected.size;
    scopeLabel = count ? `${state.code}과 · 직접 선택 ${count}개` : `${state.code}과 · 단어 미선택`;
    scopeUi = `<div class="middle-lesson-tabs setup-choice-row">${state.codes.map(range => {
      const n = state.words.filter(word => String(word.range_code) === String(range)).length;
      return `<button data-middle-lesson="${esc(range)}" class="${String(range) === state.code ? 'selected' : ''}">${esc(range)}과 <small>${n}개</small></button>`;
    }).join('')}</div>
      <div class="middle-direct-picker-v1343">
        <div class="middle-direct-toolbar-v1343">
          <div><strong>시험 볼 단어 직접 선택</strong><small>외운 단어만 체크하세요.</small></div>
          <b id="middle-direct-count">${count}개 선택</b>
        </div>
        <div class="middle-direct-actions-v1343">
          <button type="button" data-middle-word-all="true">전체 선택</button>
          <button type="button" data-middle-word-all="false">전체 해제</button>
        </div>
        <div class="middle-direct-list-v1343">
          ${state.lessonWords.map((word,index) => `<label class="middle-direct-word-v1343 ${selected.has(word.id) ? 'selected' : ''}">
            <input type="checkbox" data-middle-word="${esc(word.id)}" ${selected.has(word.id) ? 'checked' : ''}>
            <span class="middle-direct-check-v1343"></span>
            <span class="middle-direct-number-v1343">${index + 1}</span>
            <span class="middle-direct-copy-v1343"><b>${esc(word.word)}</b><small>${esc(word.meaning)}</small></span>
          </label>`).join('')}
        </div>
      </div>`;
  } else {
    // V13.124: 과 칩을 누르면 그 과의 빠른 버튼과 체크 목록이 열리고, 여러 과에서 고른 단어가 합쳐진다.
    let sel = highExamSelection(A);
    if (!sel.lessons.some(lesson => lesson.code === String(A.highExamOpen || ''))) A.highExamOpen = sel.lessons[0]?.code || '';
    const openLesson = sel.lessons.find(lesson => lesson.code === String(A.highExamOpen));
    if (openLesson) { highLessonPick(A, 'exam', openLesson.code, openLesson.lessonWords); sel = highExamSelection(A); }
    const { state, availableTypes, lessons, parts } = sel;
    count = sel.wordIds.length;
    over = count > HIGH_EXAM_MAX;
    scopeLabel = parts.length ? `${parts.map(lesson => `${rangeLabel(A.school, lesson.code)} ${lesson.picked.length}`).join(' + ')} = ${count}개` : '단어 미선택';
    const typeTabs = availableTypes.length > 1 ? `<div class="segment exam-source-tabs">${availableTypes.map(([key,label]) => `<button data-high-range-type="${key}" class="${A.highRangeType === key ? 'selected' : ''}">${label}</button>`).join('')}</div>` : '';
    const chips = `<div class="memorize-range-strip high-exam-strip-v13124" role="tablist" aria-label="시험 볼 과">${lessons.map(lesson => {
      const on = lesson.code === String(A.highExamOpen);
      return `<button role="tab" aria-selected="${on}" data-high-exam-lesson="${esc(lesson.code)}" class="${on ? 'selected' : ''} ${lesson.picked.length ? 'has-pick' : ''}"><strong>${esc(rangeLabel(A.school, lesson.code))}</strong><small>${lesson.picked.length ? `<b>${lesson.picked.length}</b>/` : ''}${lesson.lessonWords.length}개</small></button>`;
    }).join('')}</div>`;
    const picker = openLesson ? highWordPicker(A, { scope: 'exam', code: openLesson.code, lessonWords: openLesson.lessonWords, ids: A.highExamWordIds[openLesson.code], open: A.highExamPickOpen !== false }) : '';
    const total = `<div class="high-exam-total-v13124 ${over ? 'over' : ''} ${count ? '' : 'empty'}" id="high-exam-total"><span>시험 볼 단어</span><b>${count ? esc(scopeLabel) : '0개'}</b>${over ? `<em>한 번에 최대 ${HIGH_EXAM_MAX}개까지 볼 수 있어요. ${count - HIGH_EXAM_MAX}개를 빼 주세요.</em>` : count ? '' : '<em>시험 볼 단어를 먼저 선택해주세요</em>'}</div>`;
    scopeUi = schoolSwitch(A) + periodTabs(A, state.codes, 'data-high-period') + typeTabs + chips + picker + total;
  }
  const target = count;
  return `<div class="exam-mode-switch segment"><button data-exam-kind="practice" class="${!testMode ? 'selected' : ''}">연습시험</button><button data-exam-kind="test" class="${testMode ? 'selected' : ''}">실전시험</button></div>
    <div class="page-heading exam-shared-heading"><h1>${testMode ? '실전시험' : '연습시험'}</h1></div>
    <section class="setup-section"><div class="step-label"><span>01</span>시험 범위</div>${scopeUi}</section>
    <section class="setup-section"><div class="step-label"><span>02</span>시험 방식</div>${examWritingPicker(A, testMode)}</section>
    ${testMode && count && !over ? `<div class="test-rules-v1380"><span>⏳ 시험 전체 <b>${(sec => sec % 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec / 60}분`)(testDurationSec(A.mode, target || count))}</b> · 문제마다 재지 않아요</span><span>⏭ 헷갈리면 <b>PASS</b> → 마지막에 다시 나와요</span><span>📵 다른 앱으로 <b>${TEST_LEAVE_LIMIT}번</b> 나가면 자동 제출</span></div>` : ''}
    <div class="exam-start-inline"><p>${count || middle ? `${esc(scopeLabel)} · ${target || 0}문제 · ${esc(PRACTICE_TYPES[A.mode] || '뜻쓰기')}` : '시험 볼 단어를 먼저 선택해주세요'}</p><button class="btn primary full" data-action="start-exam-run" ${count && !over ? '' : 'disabled'}>${testMode ? '실전시험 시작' : '연습시험 시작'} ${icon('arrow')}</button></div>`;
}

// V13.66 ranking: 학습 랭킹 (경험치 · 코인 · 연습량 · 연속 학습, with a top-3 podium and titles)
// and 야차 리그 (the weekly league board, loaded when it opens).
const RANK_MODES = [['xp', '경험치'], ['coins', '코인'], ['total', '연습량'], ['streak', '연속 학습']];
function rankScore(value, mode) {
  const n = num(value || 0);
  return mode === 'coins' ? `${coin()}${n}` : mode === 'xp' ? `${n}<small>경험치</small>` : mode === 'streak' ? `${n}<small>일</small>` : `${n}<small>문제</small>`;
}
function podium(top, metric, mode, rankNo) {
  return `<div class="rank-podium-v1366" aria-label="1~3위">${[1, 0, 2].map(i => {
    const p = top[i];
    return `<div class="pod pod-${i + 1}${p.is_me ? ' me' : ''}">
      <div class="pod-pet">${avatar(p.avatar_key, { form: p.private ? 1 : Math.max(1, p.pet_form ?? petForm(p.level)) })}<i class="pod-medal" aria-hidden="true">${i + 1}</i></div>
      <b class="pod-name">${esc(p.display_name)}</b>
      ${shownTitle(p.title) ? titleBadge(p.title, { size: 'xs' }) : '<span class="pod-grade">' + esc(p.grade || '') + '</span>'}
      <span class="pod-score">${rankScore(p[metric], mode)}</span>
      <div class="pod-base" aria-label="${rankNo(p)}위"><span>${rankNo(p)}</span></div>
    </div>`;
  }).join('')}</div>`;
}
function ranking(A) {
  const view = A.rankView === 'league' ? 'league' : 'study';
  const head = `${A.rankFrom === 'me' ? backTo('me', '나') : backTo('home', '홈')}<div class="page-heading rank-heading-v1326"><h1>SUMUS 랭킹</h1><p>${view === 'league' ? '같은 학교·학년 친구들과 겨루는 주간 야차 리그예요.' : '시험 점수가 아닌 실제 학습 기록으로 올라가요.'}</p></div>
    <div class="segment rank-view-v1366" role="group" aria-label="랭킹 종류"><button type="button" data-rank-view="study" class="${view === 'study' ? 'selected' : ''}" aria-pressed="${view === 'study'}">학습 랭킹</button><button type="button" data-rank-view="league" class="${view === 'league' ? 'selected' : ''}" aria-pressed="${view === 'league'}">야차 리그</button></div>`;
  if (view === 'league') return `${head}<div class="lg-board" data-league-board data-period="${A.leaguePeriod === 'all' ? 'all' : 'week'}"></div>`;
  const mode = RANK_MODES.some(([key]) => key === A.rankMode) ? A.rankMode : 'xp';
  const scope = A.rankScope || 'all';
  const period = A.rankPeriod || 'week';
  const metric = period === 'all' ? (mode === 'streak' ? 'all_streak' : `all_${mode}`) : mode;
  const all = [...A.data.ranking];
  const filtered = scope === 'all' ? all : all.filter(p => p.grade === scope);
  const items = filtered.sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0) || Number(b.xp || 0) - Number(a.xp || 0));
  const myIndex = items.findIndex(p => p.is_me);
  const scopeLabel = scope === 'all' ? '전체' : scope;
  const info = A.data.ranking_period || {};
  const periodTitle = period === 'week' ? (info.label || '이번 주') : '통합 누적';
  const periodRange = period === 'week' ? (info.range || '월요일 ~ 일요일') : '전체 학습 기록';
  const rankNo = item => Number(item[metric] || 0) > 0 ? items.findIndex(x => Number(x[metric] || 0) === Number(item[metric] || 0)) + 1 : '—';
  const scopeOptions = [['all','전체'],['중2','중2'],['중3','중3'],['고1','고1']];
  const periodOptions = [['week','이번 주'],['all','통합']];
  const showPodium = items.length >= 3 && Number(items[2][metric] || 0) > 0;
  const rows = showPodium ? items.slice(3) : items;
  const modeNote = mode === 'coins' ? '모은 코인: 학습 보상 + 야차전에서 딴 코인 + 대회 상금 (쓴 코인·잃은 코인은 빼지 않아요)' : '';
  return `${head}
    <div class="rank-filter-bar" aria-label="랭킹 필터">
      <label><span>학년</span><select data-rank-scope-select>${scopeOptions.map(([k,label]) => `<option value="${k}" ${scope === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>기간</span><select data-rank-period-select>${periodOptions.map(([k,label]) => `<option value="${k}" ${period === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>기준</span><select data-rank-mode-select>${RANK_MODES.map(([k,label]) => `<option value="${k}" ${mode === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    <p class="rank-period-caption">${esc(periodTitle)} · ${esc(periodRange)}</p>
    ${period === 'week' && mode === 'xp' ? `<div class="rank-award-v1366">${titleEmblem('weekly1', { size: 'sm' })}<span>이번 주 <b>학년별 경험치 1~3위</b>는 다음 주 내내 <b>한정 칭호</b>를 달아요!</span></div>` : ''}
    ${modeNote ? `<p class="rank-mode-note-v1366">${coin()} ${esc(modeNote)}</p>` : ''}
    ${myIndex >= 0 ? `<div class="my-rank-card"><span>내 ${scopeLabel} 순위</span><strong>${rankNo(items[myIndex])}<small>위</small></strong><p>${rankScore(items[myIndex][metric], mode)} · ${esc(periodTitle)}</p></div>` : ''}
    ${showPodium ? podium(items.slice(0, 3), metric, mode, rankNo) : ''}
    <div class="rank-list">${rows.length ? rows.map((p, index) => `<div class="rank-row ${p.is_me ? 'me' : ''} ${!showPodium && index < 3 && Number(p[metric] || 0) ? 'top-rank top-' + (index + 1) : ''}"><span class="rank-number">${rankNo(p)}</span>${avatar(p.avatar_key, { size: 'mini', form: p.private ? 1 : Math.max(1, p.pet_form ?? petForm(p.level)) })}<div class="grow"><strong>${esc(p.display_name)} ${p.is_me ? '<span class="pill green">나</span>' : ''}</strong><small><span class="rank-grade">${esc(p.grade || '')}</span> · ${p.private ? '프로필 비공개' : `Lv.${p.level} · ${esc(p.pet_name || CHARACTERS[petKey(p.avatar_key)].ko)}`}</small>${shownTitle(p.title) ? `<span class="rank-title-v1366">${titleBadge(p.title, { size: 'xs' })}</span>` : ''}</div><span class="rank-score">${rankScore(p[metric], mode)}</span></div>`).join('') : showPodium ? '' : emptyArt('empty-records', 'ranking', `${scopeLabel}에 아직 연습 기록이 없어요`, '학습을 시작하면 순위가 바로 생겨요.')}</div>
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
  return `${studyTabs(A)}<div class="page-heading records-heading-v1327"><span class="premium-eyebrow">MY RECORD</span><h1>내 기록</h1><p>점수보다 중요한 건 꾸준히 쌓인 학습이에요.</p></div>
    <section class="record-summary-v1327"><div class="record-summary-main"><span>이번 주 평균</span><strong>${weeklyAvg === null ? '—' : weeklyAvg}<small>${weeklyAvg === null ? '' : '점'}</small></strong><p>${weeklyScores.length}회 학습 기록</p></div><div class="record-summary-side"><div><span>최고 점수</span><b>${best === null ? '—' : best + '점'}</b></div><div><span>누적 학습</span><b>${combined.length}회</b></div><div><span>누적 문제</span><b>${num(totalQuestions)}</b></div></div></section>
    <section class="record-achievements-v1327">${achievementSection(A, true)}</section>
    <div class="segment record-filter-v1327"><button data-record-tab="all" class="${tab === 'all' ? 'selected' : ''}">전체</button><button data-record-tab="selftest" class="${tab === 'selftest' ? 'selected' : ''}">실전</button><button data-record-tab="practice" class="${tab === 'practice' ? 'selected' : ''}">연습</button></div>
    <div class="record-timeline-v1327">${visible.length ? visible.map(rowHtml).join('') : emptyArt('empty-records', 'records', '아직 기록이 없어요', '첫 학습을 마치면 여기에 기록이 쌓여요.')}</div>`;
}
// First pet: chosen once. It starts with all the XP the student has already earned.
function petPicker(A) {
  const g = A.data.stats, startForm = Math.max(1, petForm(g.level));
  return `<div class="page-heading studio-page-heading pet-pick-heading"><span class="premium-eyebrow">NEW SUMUS PETS</span><h1>함께할 첫 친구를 골라주세요</h1><p>펫이 새로워졌어요! 지금까지 쌓은 <b>경험치 ${num(g.points || 0)}</b>로 바로 자라요.</p></div>
    <ul class="pet-pick-rules"><li><b>한 번 고르면 바꿀 수 없어요.</b> 신중하게 골라요.</li><li>다른 친구는 <b>상점의 랜덤 알(${num(EGG_PRICE)}코인)</b>로 만날 수 있어요.</li><li>능력은 모두 같아요. 마음이 가는 친구를 골라요.</li></ul>
    <div class="character-grid pet-choice-grid">${STANDARD_PET_KEYS.map(key => [key, CHARACTERS[key]]).map(([key, c]) => `<button data-action="choose-pet" data-key="${key}" class="character-option">${avatar(key, { form: startForm })}<b>${c.ko}</b><small>${c.type}</small></button>`).join('')}</div>`;
}
function studio(A) {
  const p = A.data.profile, g = A.data.stats, owned = g.pets || [], tab = A.studioTab || 'character';
  if (!owned.length) return petPicker(A);
  // The title is kept as it is (chosen in the 칭호 도감); an expired limited title saves as 첫걸음.
  A.style ??= { avatar_key: g.pet?.key || owned[0].key, avatar_accessory: ACCESSORIES[p.avatar_accessory] ? p.avatar_accessory : 'none', avatar_frame: p.avatar_frame || 'basic', avatar_title: titleState(A).equipped };
  const s = A.style, chosen = owned.find(x => x.key === s.avatar_key) || owned[0], c = CHARACTERS[chosen.key];
  const groups = { accessory: ACCESSORIES, frame: FRAMES };
  const missing = STANDARD_PET_KEYS.filter(key => !owned.some(x => x.key === key));
  const petCard = key => {
    const pet = owned.find(x => x.key === key);
    if (!pet) return `<div class="character-option pet-locked" aria-label="${CHARACTERS[key].type}, 아직 만나지 못했어요"><span class="pet-locked-art">${artOr(CHARACTERS[key].legendary || CHARACTERS[key].mythic ? 'pet-legend-locked' : CHARACTERS[key].epic ? 'pet-epic-locked' : 'pet-locked', CHARACTERS[key].epic ? '★' : '?', 'locked-art')}</span><b>???</b><small>${CHARACTERS[key].legendary ? '행운 뽑기 · 영웅 알' : CHARACTERS[key].epic ? '영웅 알 · 뽑기' : '상점의 알'}</small></div>`;
    return `<button data-style="avatar_key" data-value="${key}" class="character-option ${s.avatar_key === key ? 'selected' : ''}" aria-pressed="${s.avatar_key === key}">${avatar(key, { form: pet.form })}<b>${esc(petDisplayName(pet))}</b><small>${pet.form ? `Lv.${pet.level} · ${PET_FORMS[pet.form]}` : '알'}</small></button>`;
  };
  const shop = `<button type="button" class="pet-shop-banner" data-action="egg-shop"><span class="pet-shop-banner-egg" aria-hidden="true">?</span><span><strong>랜덤 알 상점</strong><small>${missing.length ? `${num(EGG_PRICE)}코인 · 상점에서 아직 못 만난 친구 ${missing.length}마리` : '상점 펫을 모두 모았어요!'}</small></span><b>${coin()}${num(g.points_balance || 0)}</b></button>`;
  const t = titleState(A);
  const body = tab === 'character'
    ? `${shop}<div class="pet-choice-head"><span>MY PETS · ${owned.length}/${ACTIVE_PET_KEYS.length}</span><h2>누구와 함께 공부할까요?</h2><p>파트너로 함께 공부한 펫이 자라요.</p></div><div class="character-grid pet-choice-grid">${ACTIVE_PET_KEYS.map(petCard).join('')}</div>`
    : tab === 'title'
    ? `<button type="button" class="tt-studio-link" data-go="titles">${titleEmblem(t.equipped, { size: 'md' })}<span class="tt-studio-copy"><small>지금 달고 있는 칭호</small>${titleBadge(t.equipped, { size: 'sm' })}<em>칭호 도감에서 ${titleCount(A)}개를 모았어요. 골라서 달아 보세요.</em></span>${icon('chevron')}</button>`
    : `<div class="reward-grid">${Object.entries(groups[tab]).filter(([, item]) => !item.gacha || unlocked(item, g)).map(([key, item]) => { const open = unlocked(item, g); if (item.gacha) return `<button data-style="avatar_${tab}" data-value="${key}" class="reward-item gacha t-${item.tier} ${s['avatar_' + tab] === key ? 'selected' : ''}">${capsuleArt(A, item.gacha, 'xs')}<b>${esc(item.name)}</b><small>뽑기 · ${GACHA_TIERS[item.tier].name}</small></button>`; return `<button data-style="avatar_${tab}" data-value="${key}" class="reward-item ${s['avatar_' + tab] === key ? 'selected' : ''}" ${open ? '' : 'disabled'}>${icon(open ? 'sparkle' : 'lock')}<b>${item.name}</b><small>${open ? '사용 가능' : `Lv.${item.level}에 열려요`}</small></button>`; }).join('')}</div>`;
  const isPartner = chosen.key === g.pet?.key;
  return `${backTo('me', '나')}<div class="page-heading studio-page-heading"><h1>내 펫</h1><p>파트너를 바꾸거나 꾸밀 수 있어요.</p></div><div class="studio-preview">${avatar(chosen.key, { form: chosen.form, accessory: s.avatar_accessory, frame: s.avatar_frame })}<h2>${chosen.form ? esc(petDisplayName(chosen)) : '???'} <span class="tiny muted">Lv.${chosen.level}</span>${isPartner && chosen.form ? `<button type="button" class="pet-name-edit" data-action="pet-name">${chosen.name ? '이름 바꾸기' : '이름 짓기'}</button>` : ''}</h2><p>${esc(c.type)} · ${chosen.form ? PET_FORMS[chosen.form] : '부화를 기다리는 중'}</p>${titleBadge(t.equipped, { size: 'sm' })}</div><div class="segment">${[['character', '펫'], ['accessory', '장식'], ['frame', '프레임'], ['title', '칭호']].map(([k, label]) => `<button data-studio-tab="${k}" class="${tab === k ? 'selected' : ''}">${label}</button>`).join('')}</div>${body}<button class="btn primary full" data-action="save-style">${isPartner ? '이 모습으로 저장' : `${esc(petJosa(petDisplayName(chosen), '과', '와'))} 함께하기`}</button><div class="section-title"><h2>다음 성장의 선물</h2></div><div class="roadmap">${[[3, '헤드셋'], [5, '실버 프레임'], [6, '글래스'], [9, '스타 핀'], [10, '블루 라인'], [15, '오로라'], [18, '크라운'], [20, '골드']].map(([lv, name]) => `<div><div class="milestone ${g.level >= lv ? 'done' : ''}">${icon(g.level >= lv ? 'check' : 'lock')}</div><b>${name}</b><small>Lv.${lv}</small></div>`).join('')}</div>`;
}
export function updateRangeSummary(A) {
  const { selected } = getRanges(A);
  const count = selectedCount(A);
  if ($('#scope-count')) $('#scope-count').textContent = `${selected.length}개 범위 · ${count}개 단어`;
  const all = $('[data-all-count]'); if (all) all.textContent = `${count}개 단어 모두 보기`;
  const start = $('[data-action="start-exam-run"]'); if (start) start.disabled = !selectedCount(A);
}
