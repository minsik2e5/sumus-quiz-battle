import { CHARACTERS, ACCESSORIES, FRAMES, PRACTICE_TYPES, EXAM_TYPES, PRACTICE_SECONDS_PER_QUESTION, PET_FORMS, PET_FORM_LEVELS, EGG_PRICE, petForm, unlocked, levelInfo, dayKey } from './core.js';
import { icon, esc, num, date, rangeLabel, recordRangeLabel, scope, empty, $, $$ } from './ui.js';
import { avatar, petKey, RUN_SHEETS } from './character.js';
import { petDisplayName, petJosa } from './pet-moments.js';
import { TITLES, TITLE_KEYS } from './titles.js';
import { titleBadge, titleEmblem, tierEmblem, coin, trophy } from './emblems.js';
import { titlesPage, titleState, titleCount } from './titles-ui.js';
import { tournamentCard } from './tournament-ui.js';
import { shownTitle } from './league-ui.js';
import { arcadePage, gachaBookPage, capsuleArt } from './arcade.js';
import { ATTENDANCE_REWARDS, ATTENDANCE_TICKETS, GACHA_ITEMS, GACHA_TIERS } from './rewards.js';
// V13.68 menu: what students do. 학습 holds word study, tests and records; 나 holds what they
// collect. Pages without their own button light up the one they belong to.
export const studentTabs = [['home', '홈', 'home'], ['practice', '학습', 'practice'], ['yacha', '야차전', 'battle'], ['arcade', '놀이터', 'arcade'], ['me', '나', 'user']];
const NAV_OF = { exam: 'practice', records: 'practice', ranking: 'home', studio: 'me', titles: 'me', gachabook: 'me' };
// V13.70 the ranking also opens from 나 (A.rankFrom), and then belongs to 나.
export const navOf = (tab, A = null) => tab === 'ranking' && A?.rankFrom === 'me' ? 'me' : NAV_OF[tab] || tab;
// V13.66: coins (코인) sit in the header on every tab; tapping opens the wallet.
function coinChip(A) {
  const balance = Number(A.data.stats?.points_balance ?? 0);
  return `<button class="coin-chip-v1366" data-action="coins" aria-label="내 코인 ${num(balance)}개 · 코인 지갑 열기">${coin()}<b>${num(balance)}</b></button>`;
}
export function shell(A, content) {
  const p = A.data.profile;
  return `<div class="student-app"><main class="student-main"><header class="app-header"><div class="brand"><img src="/sumus-logo-green.svg" alt=""><div>SUMUS <span>VOCA</span></div></div>${p.preview_owner_id ? '<button class="preview-exit-v1359" data-action="exit-student-preview">← 교사 화면</button>' : ''}${A.data.stats?.needs_pet_pick ? '' : coinChip(A)}<button class="profile-dot" data-action="account" aria-label="내 계정">${esc(p.display_name.slice(0, 1))}</button></header>${content}</main><nav class="bottom-nav" aria-label="주 메뉴">${studentTabs.map(([id, name, i]) => `<button data-go="${id}" class="${navOf(A.tab, A) === id ? 'active' : ''}" ${navOf(A.tab, A) === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${name}</span></button>`).join('')}</nav></div>`;
}
export function studentPage(A) {
  return shell(A, ({ home, practice, exam, ranking, records, studio, titles: titlesPage, arcade: arcadePage, yacha: yachaPage, me: mePage, gachabook: gachaBookPage }[A.tab] || home)(A));
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
  return `<div class="${teacher ? 'teacher-range' : 'range-grid'}">${codes.map(c => {
    const state = !teacher ? wordQuestState(A, c) : null;
    const meta = !teacher ? wordQuestMeta(state) : null;
    return `<label class="range-option ${meta ? 'quest-range ' + meta.cls : ''}"><input type="checkbox" data-range="${c}" ${grade ? `data-range-grade="${esc(grade)}"` : ''} ${selected.includes(c) ? 'checked' : ''} aria-label="${esc(rangeLabel(A.school, c))}"><span>${esc(rangeLabel(A.school, c))}<small>${words.filter(w => w.range_code === c).length}개 단어${meta ? ' · ' + meta.detail : ''}</small>${meta ? `<em class="quest-status ${meta.cls}">${meta.label}</em>` : ''}</span></label>`;
  }).join('')}</div><div class="scope-tools"><span id="scope-count">${selected.length}개 범위 · ${selectedCount(A, grade)}개 단어</span><div><button data-range-all="true">전체 선택</button><button data-range-all="false">해제</button></div></div>`;
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
// Home hero: the partner pet as a trading card. The card's finish follows the pet's growth
// (baby plain, growing silver, final holo); tapping flips it to the yacha record.
const CARD_FINISH = ['plain', 'plain', 'silver', 'holo'];
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
  const total = Object.keys(CHARACTERS).length;
  const number = String(Object.keys(CHARACTERS).indexOf(key) + 1).padStart(3, '0');
  const battle = g.battle || {};
  const t = titleState(A), have = new Set(t.unlocked);
  // Back of the card: the yacha titles held (and the ones still to win).
  const yachaTitles = TITLE_KEYS.filter(key => TITLES[key].group === 'yacha').filter(key => have.has(key)).slice(-4);
  const titles = yachaTitles.length ? yachaTitles.map(key => titleBadge(key, { size: 'xs' })).join('') : '<span class="partner-titles-empty">야차전 칭호에 도전해요</span>';
  const league = A.data.league;
  const finish = CARD_FINISH[form];
  return `<section class="partner-card-v1358 finish-${finish}" style="--pet:${pet.color};--pet-light:${pet.light};--pet-soft:${pet.soft}" aria-label="나의 파트너 카드">
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
            <span class="partner-foot"><span class="partner-stars" aria-label="모은 펫 ${owned}/${total}">${'★'.repeat(owned)}${'☆'.repeat(Math.max(0, total - owned))}</span><span>No.${number} · SUMUS${finish === 'plain' ? '' : `<b class="partner-finish">${finish === 'holo' ? 'HOLO' : 'SILVER'}</b>`}</span></span>
          </span>
          <span class="partner-sheen" aria-hidden="true"></span>
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
function petCareBar(A, hatched) {
  const care = A.data.care;
  if (!care) return '';
  const item = (kind, label, emoji) => {
    const done = !!care[kind];
    return `<button type="button" class="pet-care-btn ${done ? 'done' : ''}" data-pet-care="${kind}" ${done ? 'aria-disabled="true"' : ''} aria-label="${label}${done ? ', 오늘 완료' : `, 경험치 ${care.xp?.[kind] || 10}`}"><span class="pet-care-emoji" aria-hidden="true">${emoji}</span><span class="pet-care-label">${label}</span><small>${done ? '오늘 완료 ✓' : `경험치 +${care.xp?.[kind] || 10}`}</small></button>`;
  };
  return `<div class="pet-care-v1376" role="group" aria-label="오늘의 펫 교감">${item('pet', hatched ? '쓰다듬기' : '알 쓰다듬기', '🤚')}${item('feed', hatched ? '밥 주기' : '알 데워주기', hatched ? '🍖' : '🔥')}</div>`;
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
const STAMP_GIFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M3 7.5h18v3H3zM12 7.5V20M12 7.5C10.5 4 7 4 7 6s3 1.5 5 1.5c2 0 5 .5 5-1.5s-3.5-2-5 1.5"/></svg>';
function attendanceCard(A) {
  const a = A.data.rewards?.attendance;
  if (!a) return '';
  const last = ATTENDANCE_REWARDS.length - 1;
  const stamps = ATTENDANCE_REWARDS.map((coins, i) => {
    const on = i < a.stamps, next = !a.done && i === a.stamps;
    return `<li class="${on ? 'on' : ''}${next ? ' next' : ''}${i === last ? ' gift' : ''}"><span>${on ? STAMP_CHECK : i === last ? STAMP_GIFT : `<b>${i + 1}</b>`}</span><small>${coins}</small></li>`;
  }).join('');
  const lead = a.done
    ? `<small>출석 완료</small><strong>내일 출석하면 ${coin()}${a.next}</strong>`
    : `<small>출석 체크 · ${a.stamps + 1}번째 도장</small><strong>오늘 출석하고 ${coin()}${a.next} 받기</strong>`;
  return `<section class="att-card${a.done ? ' done' : ''}" aria-label="출석 체크">
    <div class="att-head"><div>${lead}</div>${a.done ? `<span class="att-streak">${a.streak >= 2 ? `${a.streak}일 연속` : '오늘 도장 쾅!'}</span>` : '<button type="button" class="btn primary att-btn" data-action="attend">출석하기</button>'}</div>
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
    ${compactGrowth(A)}`;
}
// V13.76 ⭐ 어려운 단어: the starred words of this school and grade, practised together.
export function starredWords(A) {
  const stars = new Set(A.memStars || []);
  if (!stars.size) return [];
  const seen = new Set();
  return (A.data.books || []).flatMap(book => book.words || []).filter(word => stars.has(word.id) && !seen.has(word.id) && seen.add(word.id));
}
function starPracticeButton(A, cls = '') {
  const n = starredWords(A).length;
  if (!n) return '';
  return `<button type="button" class="star-practice-v1376 ${cls}" data-star-practice="true"><span class="star-practice-mark" aria-hidden="true">★</span><span><small>어려운 단어 모음</small><strong>★ ${n}개 모아서 연습</strong></span><b>${icon('arrow')}</b></button>`;
}
function studyHub(A) {
  return `<div class="page-heading study-simple-heading premium-page-heading"><span class="premium-eyebrow">LEARNING</span><h1>학습</h1></div>
  ${studyDailyCard(A)}
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
  </div>
  ${starPracticeButton(A, 'in-hub')}`;
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
        const textbookCodes = state.codes.filter(code => /^L\\d+$/i.test(String(code)));
        const mockCodes = state.codes.filter(code => !/^L\\d+$/i.test(String(code)));
        const availableTypes = [['mock','모의고사',mockCodes],['textbook','교과서',textbookCodes]].filter(([, , codes]) => codes.length);
        if (!availableTypes.some(([key]) => key === A.memorizeRangeType)) A.memorizeRangeType = textbookCodes.includes(state.code) ? 'textbook' : (availableTypes[0]?.[0] || 'mock');
        const visibleCodes = A.memorizeRangeType === 'textbook' ? textbookCodes : mockCodes;
        if (visibleCodes.length && !visibleCodes.includes(state.code)) A.memorizeRange = String(visibleCodes[0]);
        const activeCode = String(A.memorizeRange || visibleCodes[0] || '');
        const tabs = availableTypes.length > 1 ? `<div class="segment exam-source-tabs memorize-source-tabs">${availableTypes.map(([key,label]) => `<button data-memorize-range-type="${key}" class="${A.memorizeRangeType === key ? 'selected' : ''}">${label}</button>`).join('')}</div>` : '';
        return schoolSwitch(A) + tabs + `<div class="memorize-range-strip" role="tablist" aria-label="학습 범위">${visibleCodes.map(range => {
          const code = String(range);
          const count = state.words.filter(word => String(word.range_code) === code).length;
          const selected = code === activeCode;
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
      ${starPracticeButton(A, 'in-memorize')}
      <div class="memorize-list">${visible.length ? visible.map((word,index) => {
        const show = allShown || revealed.has(word.id);
        const star = stars.has(word.id);
        const front = show ? word.meaning : word.word;
        return `<div class="memorize-row ${show ? 'revealed' : ''} ${star ? 'starred' : ''}">
          <button class="memorize-star" data-memorize-star="${esc(word.id)}" aria-label="${star ? '어려운 단어 해제' : '어려운 단어 표시'}">${star ? '★' : '☆'}</button>
          <button class="memorize-word" data-memorize-word="${esc(word.id)}" aria-label="${esc(word.word)} ${show ? '영어 보기' : '뜻 보기'}"><span class="memorize-no">${index + 1}</span><strong>${esc(front)}</strong></button>
          <button class="memorize-sound" data-memorize-speak="${esc(word.id)}" aria-label="${esc(word.word)} 발음 듣기">${icon('sound')}</button>
        </div>`;
      }).join('') : `<div class="memorize-empty">${starredOnly ? '이 범위에 ★ 표시한 단어가 없어요. 헷갈리는 단어의 ☆를 눌러 모아 두세요.' : '표시할 단어가 없어요. 범위를 선택해주세요.'}</div>`}</div>
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
  return `<button type="button" class="home-next-v1358 study-daily-v1371" data-quick-practice="true"><span><small>오늘의 추천 학습</small><strong>${done > 0 ? `오늘 ${goal - done}개 남았어요` : `오늘은 ${daily.target}개만 끝내요`}</strong><em>오답 ${mix.wrong || 0} · 복습 ${mix.review || 0} · 새 단어 ${mix.new || 0}</em>${homeProgress(done, goal, '오늘 학습')}</span><b>${done > 0 ? '오늘 학습 계속' : '오늘 학습 시작'} ${icon('arrow')}</b></button>`;
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
    <div class="me-tiles-v1368${gachaHave ? ' four' : ''}">
      <button type="button" class="me-tile pet" data-go="studio"><span class="me-ico">${icon('user')}</span><b>내 펫·꾸미기</b><small>펫 ${owned}/${Object.keys(CHARACTERS).length}</small></button>
      <button type="button" class="me-tile rank" data-go="ranking" data-from="me" data-rank-grade="${esc((A.data.ranking || []).find(r => r.is_me)?.grade || '')}"><span class="me-ico">${icon('ranking')}</span><b>랭킹</b><small>${myRankLine(A)}</small></button>
      <button type="button" class="me-tile titles" data-go="titles"><span class="me-ico">${icon('star')}</span><b>칭호 도감</b><small>${titleCount(A)}${(t.fresh || []).length ? ' · <i class="me-new">NEW</i>' : ''}</small></button>
      ${gachaHave ? `<button type="button" class="me-tile gacha" data-go="gachabook"><span class="me-ico">${icon('arcade')}</span><b>모은 꾸미기</b><small>${gachaHave}개</small></button>` : ''}
    </div>
    <section class="me-stats-v1368" aria-label="내 기록">
      <div><b>${num(g.streak || 0)}<small>일</small></b><span>연속 학습</span></div>
      <div><b>${num(att.total || 0)}<small>번</small></b><span>출석</span></div>
      <div><b>${num(battle.wins || 0)}<small>승</small></b><span>야차전</span></div>
      <div><b>${num(g.best_combo || 0)}</b><span>최고 연속 정답</span></div>
    </section>`;
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
    return `${studyTabs(A)}<div class="page-heading exam-choice-heading premium-page-heading"><span class="premium-eyebrow">TEST</span><h1>시험</h1></div>
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
    <div class="rank-list">${rows.length ? rows.map((p, index) => `<div class="rank-row ${p.is_me ? 'me' : ''} ${!showPodium && index < 3 && Number(p[metric] || 0) ? 'top-rank top-' + (index + 1) : ''}"><span class="rank-number">${rankNo(p)}</span>${avatar(p.avatar_key, { size: 'mini', form: p.private ? 1 : Math.max(1, p.pet_form ?? petForm(p.level)) })}<div class="grow"><strong>${esc(p.display_name)} ${p.is_me ? '<span class="pill green">나</span>' : ''}</strong><small><span class="rank-grade">${esc(p.grade || '')}</span> · ${p.private ? '프로필 비공개' : `Lv.${p.level} · ${esc(p.pet_name || CHARACTERS[petKey(p.avatar_key)].ko)}`}</small>${shownTitle(p.title) ? `<span class="rank-title-v1366">${titleBadge(p.title, { size: 'xs' })}</span>` : ''}</div><span class="rank-score">${rankScore(p[metric], mode)}</span></div>`).join('') : showPodium ? '' : empty('ranking', `${scopeLabel}에 아직 연습 기록이 없어요`, '학습을 시작하면 순위가 바로 생겨요.')}</div>
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
    <div class="record-timeline-v1327">${visible.length ? visible.map(rowHtml).join('') : empty('records','아직 기록이 없어요','첫 학습을 마치면 여기에 기록이 쌓여요.')}</div>`;
}
// First pet: chosen once. It starts with all the XP the student has already earned.
function petPicker(A) {
  const g = A.data.stats, startForm = Math.max(1, petForm(g.level));
  return `<div class="page-heading studio-page-heading pet-pick-heading"><span class="premium-eyebrow">NEW SUMUS PETS</span><h1>함께할 첫 친구를 골라주세요</h1><p>펫이 새로워졌어요! 지금까지 쌓은 <b>경험치 ${num(g.points || 0)}</b>로 바로 자라요.</p></div>
    <ul class="pet-pick-rules"><li><b>한 번 고르면 바꿀 수 없어요.</b> 신중하게 골라요.</li><li>다른 친구는 <b>상점의 랜덤 알(${num(EGG_PRICE)}코인)</b>로 만날 수 있어요.</li><li>능력은 모두 같아요. 마음이 가는 친구를 골라요.</li></ul>
    <div class="character-grid pet-choice-grid">${Object.entries(CHARACTERS).map(([key, c]) => `<button data-action="choose-pet" data-key="${key}" class="character-option">${avatar(key, { form: startForm })}<b>${c.ko}</b><small>${c.type}</small></button>`).join('')}</div>`;
}
function studio(A) {
  const p = A.data.profile, g = A.data.stats, owned = g.pets || [], tab = A.studioTab || 'character';
  if (!owned.length) return petPicker(A);
  // The title is kept as it is (chosen in the 칭호 도감); an expired limited title saves as 첫걸음.
  A.style ??= { avatar_key: g.pet?.key || owned[0].key, avatar_accessory: ACCESSORIES[p.avatar_accessory] ? p.avatar_accessory : 'none', avatar_frame: p.avatar_frame || 'basic', avatar_title: titleState(A).equipped };
  const s = A.style, chosen = owned.find(x => x.key === s.avatar_key) || owned[0], c = CHARACTERS[chosen.key];
  const groups = { accessory: ACCESSORIES, frame: FRAMES };
  const missing = Object.keys(CHARACTERS).filter(key => !owned.some(x => x.key === key));
  const petCard = key => {
    const pet = owned.find(x => x.key === key);
    if (!pet) return `<div class="character-option pet-locked" aria-label="${CHARACTERS[key].type}, 아직 만나지 못했어요"><span class="pet-locked-art">?</span><b>???</b><small>상점의 알</small></div>`;
    return `<button data-style="avatar_key" data-value="${key}" class="character-option ${s.avatar_key === key ? 'selected' : ''}" aria-pressed="${s.avatar_key === key}">${avatar(key, { form: pet.form })}<b>${esc(petDisplayName(pet))}</b><small>${pet.form ? `Lv.${pet.level} · ${PET_FORMS[pet.form]}` : '알'}</small></button>`;
  };
  const shop = `<button type="button" class="pet-shop-banner" data-action="egg-shop"><span class="pet-shop-banner-egg" aria-hidden="true">?</span><span><strong>랜덤 알 상점</strong><small>${missing.length ? `${num(EGG_PRICE)}코인 · 아직 못 만난 친구 ${missing.length}마리` : '모든 친구를 모았어요!'}</small></span><b>${coin()}${num(g.points_balance || 0)}</b></button>`;
  const t = titleState(A);
  const body = tab === 'character'
    ? `${shop}<div class="pet-choice-head"><span>MY PETS · ${owned.length}/${Object.keys(CHARACTERS).length}</span><h2>누구와 함께 공부할까요?</h2><p>파트너로 함께 공부한 펫이 자라요.</p></div><div class="character-grid pet-choice-grid">${Object.keys(CHARACTERS).map(petCard).join('')}</div>`
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
