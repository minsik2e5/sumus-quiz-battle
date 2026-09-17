import { api, esc, num, date, icon } from './modules/ui.js';
import { ACCESSORIES, FRAMES, TITLES } from './modules/core.js';

const app = document.querySelector('#app');
let cache = null;
let cacheAt = 0;

function injectStyles() {
  if (document.querySelector('#student-enhance-style')) return;
  const style = document.createElement('style');
  style.id = 'student-enhance-style';
  style.textContent = `
    .sumus-student-insights{margin-top:22px}
    .sumus-student-insights .section-title{margin-bottom:10px}
    .sumus-week-card{border:1px solid #e7eaf0;background:linear-gradient(180deg,#fff,#fafbfc);border-radius:22px;padding:18px;box-shadow:0 10px 30px rgba(16,24,40,.05)}
    .sumus-week-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
    .sumus-week-grid>div{padding:13px 10px;background:#fff;border:1px solid #eef0f3;border-radius:15px;text-align:center}
    .sumus-week-grid strong{display:block;font-size:18px;letter-spacing:-.4px}
    .sumus-week-grid span{display:block;margin-top:4px;font-size:11px;color:#98a2b3}
    .sumus-week-bar{margin-top:14px}
    .sumus-week-bar .row{font-size:12px;color:#667085;margin-bottom:7px}
    .sumus-week-bar .progress{height:8px}
    .sumus-focus-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
    .sumus-focus-card{border:1px solid #e7eaf0;background:#fff;border-radius:18px;padding:15px;text-align:left;min-height:116px;display:flex;flex-direction:column;gap:6px}
    .sumus-focus-card .icon{width:19px;height:19px;color:#667085}
    .sumus-focus-card b{font-size:15px;line-height:1.3}
    .sumus-focus-card p{font-size:12px;line-height:1.45;color:#98a2b3;margin:0}
    .sumus-focus-card .tiny-action{margin-top:auto;color:#344054;font-weight:700;font-size:12px}
    .sumus-reward-card{margin-top:10px;padding:15px 16px;border-radius:18px;background:#f7f8fa;display:flex;align-items:center;gap:12px}
    .sumus-reward-orb{width:42px;height:42px;border-radius:14px;background:#fff;border:1px solid #eaecf0;display:grid;place-items:center;flex:none}
    .sumus-reward-card .grow{min-width:0}
    .sumus-reward-card b{display:block;font-size:14px}
    .sumus-reward-card small{display:block;margin-top:3px;color:#98a2b3;font-size:11px}
    .sumus-due{color:#b54708!important}
    @media(max-width:360px){.sumus-week-grid{gap:6px}.sumus-week-grid>div{padding:11px 6px}.sumus-focus-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

async function bootstrap(force = false) {
  if (!force && globalThis.__SUMUS_BOOTSTRAP__) return globalThis.__SUMUS_BOOTSTRAP__;
  if (!force && cache && Date.now() - cacheAt < 12000) return cache;
  cache = await api('/bootstrap');
  cacheAt = Date.now();
  return cache;
}

function nextReward(stats) {
  const candidates = [
    ...Object.values(ACCESSORIES).filter(x => x.level > stats.level).map(x => ({ ...x, kind: '액세서리' })),
    ...Object.values(FRAMES).filter(x => x.level > stats.level).map(x => ({ ...x, kind: '프레임' })),
    ...Object.values(TITLES).filter(x => x.level && x.level > stats.level).map(x => ({ ...x, kind: '칭호' }))
  ].sort((a,b) => a.level - b.level);
  return candidates[0] || null;
}

function weekStats(data) {
  const cutoff = Date.now() - 7 * 86400000;
  const sessions = data.sessions.filter(s => s.created_at >= cutoff);
  const total = sessions.reduce((n,s) => n + (s.total || 0), 0);
  const correct = sessions.reduce((n,s) => n + (s.correct || 0), 0);
  const xp = sessions.reduce((n,s) => n + (s.xp || 0), 0);
  const days = new Set(sessions.filter(s => s.total > 0).map(s => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(s.created_at)))).size;
  return { total, accuracy: total ? Math.round(correct / total * 100) : 0, xp, days };
}

function dueText(ts) {
  const left = ts - Date.now();
  if (left <= 0) return '마감';
  if (left < 3600000) return `${Math.max(1, Math.ceil(left/60000))}분 남음`;
  if (left < 86400000) return `${Math.ceil(left/3600000)}시간 남음`;
  return `${Math.ceil(left/86400000)}일 남음`;
}

async function enhanceHome() {
  if (!document.querySelector('.student-app') || !document.querySelector('.home-title')) return;
  if (document.querySelector('#sumus-student-insights')) return;
  injectStyles();
  const data = await bootstrap();
  if (!document.querySelector('.home-title') || document.querySelector('#sumus-student-insights')) return;

  const week = weekStats(data);
  const goal = 100;
  const progress = Math.min(100, Math.round(week.total / goal * 100));
  const now = Date.now();
  const activeExams = data.exams.filter(e => e.active && e.due_at > now).sort((a,b) => a.due_at - b.due_at);
  const activeAssignments = data.assignments.filter(a => a.active && a.due_at > now).sort((a,b) => a.due_at - b.due_at);
  const nextExam = activeExams[0];
  const nextAssignment = activeAssignments[0];
  const reward = nextReward(data.stats);
  const urgent = nextExam && nextExam.due_at - now < 86400000;

  const node = document.createElement('section');
  node.id = 'sumus-student-insights';
  node.className = 'sumus-student-insights';
  node.innerHTML = `
    <div class="section-title"><h2>이번 주 성장</h2><span class="tiny muted">최근 7일</span></div>
    <div class="sumus-week-card">
      <div class="row between"><div><b>이번 주 ${num(week.total)}문제</b><p class="tiny muted" style="margin:4px 0 0">꾸준히 쌓인 만큼 실력이 남아요.</p></div><span class="pill blue">+${num(week.xp)}P</span></div>
      <div class="sumus-week-grid"><div><strong>${num(week.total)}</strong><span>푼 문제</span></div><div><strong>${week.accuracy}%</strong><span>정답률</span></div><div><strong>${week.days}일</strong><span>학습일</span></div></div>
      <div class="sumus-week-bar"><div class="row between"><span>주간 100문제 목표</span><b>${progress}%</b></div><div class="progress"><i style="width:${progress}%"></i></div></div>
    </div>
    <div class="section-title" style="margin-top:22px"><h2>지금 하면 좋은 것</h2></div>
    <div class="sumus-focus-grid">
      <button class="sumus-focus-card" data-go="practice">${icon('practice')}<b>${data.stats.weak ? `취약 단어 ${data.stats.weak}개 복습` : '오늘 연습 이어가기'}</b><p>${data.stats.weak ? '헷갈린 단어를 다시 만나면 더 오래 기억돼요.' : '약한 단어를 우선해서 자동으로 보여줘요.'}</p><span class="tiny-action">연습하러 가기 →</span></button>
      ${nextExam ? `<button class="sumus-focus-card" data-go="exam">${icon('exam')}<b>${esc(nextExam.title)}</b><p class="${urgent ? 'sumus-due' : ''}">${esc(dueText(nextExam.due_at))} · ${date(nextExam.due_at)} 마감</p><span class="tiny-action">시험 확인 →</span></button>` : nextAssignment ? `<button class="sumus-focus-card" data-assignment="${nextAssignment.id}">${icon('records')}<b>${esc(nextAssignment.title)}</b><p>${esc(dueText(nextAssignment.due_at))} · 목표 ${nextAssignment.target_questions}문제</p><span class="tiny-action">과제 시작 →</span></button>` : `<button class="sumus-focus-card" data-go="records">${icon('records')}<b>내 기록 확인</b><p>이번 주에 얼마나 쌓였는지 확인해보세요.</p><span class="tiny-action">기록 보기 →</span></button>`}
    </div>
    ${reward ? `<div class="sumus-reward-card"><div class="sumus-reward-orb">${icon('sparkle')}</div><div class="grow"><b>Lv.${reward.level}에 ${esc(reward.name)} 해금</b><small>다음 ${esc(reward.kind)}까지 ${Math.max(1, reward.level - data.stats.level)}레벨 남았어요.</small></div><span class="pill">다음 보상</span></div>` : `<div class="sumus-reward-card"><div class="sumus-reward-orb">${icon('star')}</div><div class="grow"><b>모든 레벨 보상을 열었어요</b><small>이제 기록과 연속 학습을 더 멋지게 쌓아보세요.</small></div><span class="pill">완주</span></div>`}
  `;

  const main = document.querySelector('.student-main');
  main?.appendChild(node);
}

const observer = new MutationObserver(() => {
  if (document.querySelector('.home-title')) enhanceHome().catch(()=>{});
});
observer.observe(app,{childList:true,subtree:true});
injectStyles();
enhanceHome().catch(()=>{});
