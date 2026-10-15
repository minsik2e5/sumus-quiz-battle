import { api, esc, num, toast, modal, buttonBusy } from './ui.js';
import { coin } from './emblems.js';
import { STREAK_GUARD } from './streak-guard.js';

// V13.149 연속 학습 보호권 화면: 홈의 불꽃 카드, 설명 · 사기 창, '보호권이 연속을 지켰어요' · '되살리기 성공' 순간.
// 규칙과 계산은 streak-guard.js(서버와 같다).

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const view = A => A.data?.stats?.streak_guard || null;

// 방패 한 장(SVG). on: 가지고 있음, used: 방금 쓰임(금이 간 방패).
export function guardShield(state = 'on', cls = '') {
  const id = `sg-${state}-${String(cls).replace(/[^a-z0-9]/gi, '') || 'x'}`; // 같은 모양은 같은 그라디언트(화면 비교가 흔들리지 않게)
  return `<svg class="sg-shield ${state} ${cls}" viewBox="0 0 64 72" aria-hidden="true"><defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be7ff"/><stop offset=".55" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}c" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a00"/><stop offset=".6" stop-color="#ffb02e"/><stop offset="1" stop-color="#fff3b0"/></linearGradient></defs>
    <path d="M32 3 58 12v20c0 18-11 30-26 37C17 62 6 50 6 32V12z" fill="url(#${id}a)" stroke="#dbeafe" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 9 52 16v16c0 14-8 24-20 30-12-6-20-16-20-30V16z" fill="none" stroke="#bfdbfe" stroke-opacity=".55" stroke-width="1.6"/>
    <path d="M32 18c6 7 10 12 10 19a10 10 0 0 1-20 0c0-4 2-7 4-9 0 4 2 6 4 6-1-6 0-11 2-16z" fill="url(#${id}c)"/>
    <path d="M32 3 58 12v8C44 18 24 22 8 34V12z" fill="url(#${id}b)"/>
    ${state === 'used' ? '<path d="M33 6 28 22l7 6-6 12 5 9" fill="none" stroke="#e2e8f0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
  </svg>`;
}
// 비어 있는 자리.
const emptySlot = () => '<svg class="sg-shield empty" viewBox="0 0 64 72" aria-hidden="true"><path d="M32 3 58 12v20c0 18-11 30-26 37C17 62 6 50 6 32V12z" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 5" stroke-linejoin="round"/><path d="M32 26v18M23 35h18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
// 연속 불꽃(일수가 늘수록 커지고 색이 바뀐다).
export function streakFlame(days) {
  const tier = days >= 30 ? 'blue' : days >= 7 ? 'hot' : days >= 1 ? 'warm' : 'out';
  return `<span class="sg-flame ${tier}" aria-hidden="true"><i class="f1"></i><i class="f2"></i><i class="f3"></i><b class="sg-spark s1"></b><b class="sg-spark s2"></b><b class="sg-spark s3"></b></span>`;
}
const slots = held => Array.from({ length: STREAK_GUARD.MAX }, (_, i) => i < held ? guardShield('on', 'sg-slot') : emptySlot()).join('');

// 홈 카드: 연속 일수 · 보호권 자리 · 되살리기 안내.
export function streakCard(A) {
  const v = view(A);
  if (!v) return '';
  const days = Number(A.data.stats?.streak || 0);
  const next = [3, 7, 14, 30, 60, 100].find(goal => goal > days);
  const repair = v.repair;
  const line = repair
    ? `<strong>${num(repair.run)}일 연속이 어제 끊겼어요!</strong><small>오늘 연습을 끝까지 풀어 <b>${num(repair.need)}문제</b>를 채우면 어제를 이어요 · 한 달에 한 번</small>`
    : v.saved_yesterday
      ? `<strong>보호권이 어제를 지켰어요</strong><small>오늘 공부하면 ${num(days + 1)}일 연속!</small>`
      : days > 0
        ? `<strong>${num(days)}일 연속 학습 중</strong><small>${next ? `${num(next)}일까지 ${num(next - days)}일 남았어요` : '전설의 연속 기록!'}${v.held ? ' · 빠지는 날은 보호권이 막아 줘요' : ''}</small>`
        : `<strong>오늘부터 연속 학습 시작!</strong><small>하루 한 번 연습을 끝까지 풀면 불꽃이 켜져요</small>`;
  return `<button type="button" class="sg-card${repair ? ' repair' : ''}${v.saved_yesterday ? ' saved' : ''}" data-action="streak-guard" aria-label="연속 학습 ${num(days)}일, 보호권 ${num(v.held)}장. 자세히 보기">
    <span class="sg-card-flame">${streakFlame(repair ? 0 : days)}<b>${num(repair ? repair.run : days)}</b></span>
    <span class="sg-card-copy">${line}</span>
    <span class="sg-card-slots" aria-hidden="true">${slots(v.held)}</span>
  </button>`;
}

// 설명 · 사기 창.
export function openGuardSheet(A, onChange) {
  const draw = () => {
    const v = view(A), days = Number(A.data.stats?.streak || 0), balance = Number(A.data.stats?.points_balance || 0);
    const full = v.held >= v.max, short = balance < v.price;
    return `<div class="sg-sheet">
      <div class="sg-sheet-top">${streakFlame(days)}<div><small>연속 학습</small><strong>${num(days)}<span>일</span></strong></div></div>
      <div class="sg-sheet-slots" aria-label="보호권 ${num(v.held)}장 / ${num(v.max)}장">${slots(v.held)}<p><b>${num(v.held)}</b> / ${num(v.max)}장</p></div>
      ${v.repair ? `<div class="sg-repair"><b>🔥 ${num(v.repair.run)}일 연속 되살리기</b><p>어제 공부를 못 했지만 아직 늦지 않았어요. <b>오늘</b> 연습을 끝까지 풀어 모두 <b>${num(v.repair.need)}문제</b>를 채우면 어제를 이어요. (정답률 60% 이상 · 30일에 한 번)</p></div>` : ''}
      <ul class="sg-rules">
        <li>${guardShield('on', 'sg-mini')}<span><b>공부를 못 한 날, 저절로 쓰여요.</b> 한 장이 하루를 지켜요. 연속이 이어지고 있을 때만 쓰여요.</span></li>
        <li>${guardShield('on', 'sg-mini')}<span><b>헛되이 사라지지 않아요.</b> 빠진 날을 다 막을 수 없으면(사흘 빠졌는데 2장) 한 장도 쓰지 않고 남겨 둬요.</span></li>
        <li>${guardShield('on', 'sg-mini')}<span><b>얻는 법</b> 출석 7번째 도장마다 1장 · 상점에서 ${coin()}${num(v.price)} · 최대 ${num(v.max)}장</span></li>
      </ul>
      ${v.used_total ? `<p class="sg-used">지금까지 보호권이 <b>${num(v.used_total)}일</b>을 지켰어요.${v.recent.length ? ` 최근: ${v.recent.map(d => esc(d.slice(5).replace('-', '/'))).join(' · ')}` : ''}</p>` : ''}
      <button type="button" class="btn primary full sg-buy" data-sg-buy ${full ? 'disabled' : ''}>${full ? '보호권이 가득 찼어요' : `${coin()}${num(v.price)}로 보호권 사기${short ? ` <small>(${num(v.price - balance)}개 부족)</small>` : ''}`}</button>
      <p class="sg-foot">보호권으로 이은 날은 연속 일수와 연속 칭호에 들어가요. 학습 기록 · 공부한 날 수에는 들어가지 않아요.</p>
    </div>`;
  };
  const close = modal(draw(), '연속 학습 보호권', { className: 'sg-modal' });
  const box = document.querySelector('#modal-root .modal');
  box?.addEventListener('click', async event => {
    const b = event.target.closest('[data-sg-buy]');
    if (!b || b.disabled) return;
    if (!b.classList.contains('confirm')) {
      b.classList.add('confirm'); b.dataset.label = b.innerHTML; b.innerHTML = '한 번 더 누르면 사요!';
      setTimeout(() => { if (b.isConnected && b.classList.contains('confirm')) { b.classList.remove('confirm'); b.innerHTML = b.dataset.label; } }, 3000);
      return;
    }
    buttonBusy(b);
    try {
      const r = await api('/shop/streak-guard', {});
      A.data.stats.streak_guard = r.streak_guard;
      A.data.stats.points_balance = r.points_balance;
      document.querySelectorAll('.coin-chip-v1366 b').forEach(x => { x.textContent = num(r.points_balance); });
      const body = box.querySelector('.sg-sheet');
      if (body) body.outerHTML = draw();
      const fresh = box.querySelectorAll('.sg-sheet-slots .sg-slot');
      fresh[r.streak_guard.held - 1]?.classList.add('pop');
      toast('보호권을 샀어요! 빠지는 날을 지켜 줄게요.');
      onChange?.();
    } catch (err) { toast(err.message); buttonBusy(b, false); }
  });
  return close;
}

// 보호권이 어제를 지켰을 때 · 되살리기에 성공했을 때 한 번(그날 한 번) 보여 주는 순간.
const seenKey = (A, kind) => `sumus:guard-${kind}:${A.data.profile.id}`;
const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function once(A, kind) {
  try { if (localStorage.getItem(seenKey(A, kind)) === todayKst()) return false; localStorage.setItem(seenKey(A, kind), todayKst()); return true; } catch { return false; }
}
export function maybeGuardMoment(A) {
  const v = view(A);
  // 다른 순간(칭호 · 펫 · 선물 상자)이 떠 있으면 다음 화면 때 다시 본다. 이 순간도 #modal-root에 넣어 다른 순간이 겹쳐 뜨지 않게 한다.
  const host = document.getElementById('modal-root');
  if (!v || A.tab !== 'home' || A.screen || !host || host.children.length || document.querySelector('.sg-moment, .att-moment')) return;
  const kind = v.repaired_today ? 'repair' : v.saved_yesterday ? 'saved' : null;
  if (!kind || !once(A, kind)) return;
  const days = Number(A.data.stats?.streak || 0);
  const box = document.createElement('div');
  box.className = `sg-moment ${kind}${reduced() ? ' still' : ''}`;
  box.innerHTML = `<div class="sg-moment-card" role="dialog" aria-modal="true" aria-label="${kind === 'repair' ? '연속 되살리기 성공' : '보호권 사용'}">
    <div class="sg-moment-art">${kind === 'repair' ? streakFlame(days) : `${guardShield('used', 'sg-moment-shield')}<span class="sg-moment-ring"></span>`}</div>
    <h2>${kind === 'repair' ? '연속 되살리기 성공!' : '보호권이 연속을 지켰어요!'}</h2>
    <p>${kind === 'repair' ? `어제를 이어서 <b>${num(days)}일 연속</b>이에요. 오늘부터 다시 달려요!` : `어제 공부를 못 했지만 보호권 1장이 막아 줬어요. 남은 보호권 <b>${num(v.held)}장</b>`}</p>
    <button type="button" class="btn primary full" data-sg-close>좋아요!</button>
  </div>`;
  box.onclick = event => { if (event.target === box || event.target.closest('[data-sg-close]')) { box.classList.remove('open'); setTimeout(() => box.remove(), 220); } };
  host.appendChild(box);
  requestAnimationFrame(() => box.classList.add('open'));
  box.querySelector('[data-sg-close]').focus({ preventScroll: true });
  navigator.vibrate?.(kind === 'repair' ? [40, 60, 90] : 60);
}
