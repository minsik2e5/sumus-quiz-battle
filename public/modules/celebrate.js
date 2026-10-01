import { $, api, esc, num, icon, toast } from './ui.js';
import { coin } from './emblems.js';

// V13.73 celebrations shared by the title moment and the teacher's coin gift: coins raining
// over a pop-up, a number counting up, and the gift box a student opens.

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Coins falling over `box` (an element with position:relative). `wave` > 1 adds later waves.
export function coinShower(box, count = 24, wave = 1) {
  if (!box || reducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'cel-coins';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = Array.from({ length: count * wave }, (_, i) => {
    const x = Math.random() * 100, delay = Math.floor(i / count) * 520 + Math.random() * 420, size = 16 + Math.random() * 14, spin = 360 + Math.random() * 540;
    return `<i style="--x:${x}%;--d:${delay}ms;--s:${size}px;--r:${spin}deg;--t:${1100 + Math.random() * 700}ms"></i>`;
  }).join('');
  box.appendChild(layer);
  setTimeout(() => layer.remove(), 2600 + wave * 520);
}
// "+60" counting up from 0.
export function countUp(el, to, ms = 900) {
  if (!el) return;
  if (reducedMotion() || to <= 0) { el.textContent = num(to); return; }
  const start = performance.now();
  const step = t => {
    const k = Math.min(1, (t - start) / ms), eased = 1 - Math.pow(1 - k, 3);
    el.textContent = num(Math.round(to * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// The coin line under a title or a gift: "+60 코인" that counts up and pops.
export const coinReward = (amount, label = '코인') => `<div class="cel-reward" aria-label="${num(amount)} ${label}">${coin()}<b>+<span data-cel-count="${amount}">0</span></b><small>${label}</small></div>`;
export function playReward(root, delay = 350) {
  const el = root?.querySelector('[data-cel-count]');
  if (!el) return;
  setTimeout(() => { el.closest('.cel-reward')?.classList.add('on'); countUp(el, Number(el.dataset.celCount)); }, reducedMotion() ? 0 : delay);
}
const buzz = pattern => { try { navigator.vibrate?.(pattern); } catch {} };

// Gifts waiting for the student (bootstrap `gifts`): one box for all of them. Opening it asks
// the server to mark them opened (the coins were already counted when they were sent).
export function giftMoment(A, gifts, done) {
  const total = gifts.reduce((n, g) => n + Number(g.amount || 0), 0);
  const from = [...new Set(gifts.map(g => g.from_name).filter(Boolean))];
  const notes = gifts.filter(g => g.note).slice(-3);
  $('#modal-root').innerHTML = `<div class="modal-backdrop cel-gift-backdrop"><section class="modal cel-gift" role="dialog" aria-modal="true" aria-label="선생님의 코인 선물">
    <div class="cel-gift-stage" data-state="closed">
      <span class="cel-gift-rays" aria-hidden="true"></span>
      <button type="button" class="cel-box" data-gift-open aria-label="선물 상자 열기">
        <span class="cel-box-lid"><i></i></span><span class="cel-box-body"><i></i></span>
      </button>
      <div class="cel-gift-burst" aria-hidden="true"></div>
    </div>
    <span class="cel-kicker">${from.length ? `${esc(from.map(n => /선생님$/.test(n) ? n : `${n} 선생님`).join(', '))}의 선물` : '선생님의 선물'}</span>
    <h2 class="cel-gift-title">선물이 도착했어요!</h2>
    ${notes.length ? `<div class="cel-notes">${notes.map(g => `<p>“${esc(g.note)}”</p>`).join('')}</div>` : ''}
    <div class="cel-gift-reward" hidden>${coinReward(total)}${gifts.length > 1 ? `<small class="cel-gift-count">선물 ${gifts.length}개</small>` : ''}</div>
    <div class="pet-moment-actions"><button type="button" class="btn primary full" data-gift-go>${icon('sparkle')}상자 열기</button></div>
  </section></div>`;
  const stage = $('.cel-gift-stage'), button = $('[data-gift-go]');
  let opened = false;
  const open = async () => {
    if (opened) return;
    opened = true;
    button.disabled = true;
    let res = null;
    try { res = await api('/gifts/open', {}); }
    catch (err) { toast(err.message); opened = false; button.disabled = false; return; }
    if (res?.points_balance !== undefined && A.data?.stats) A.data.stats.points_balance = res.points_balance;
    A.data.gifts = [];
    // Already opened on another phone: nothing new to show (the coins were counted once).
    if (Array.isArray(res?.gifts) && !res.gifts.length) { $('#modal-root').innerHTML = ''; toast('선물은 이미 받았어요.'); done?.(); return; }
    // What the server just opened, not this phone's older list.
    if (Number.isFinite(Number(res?.coins))) {
      const reward = $('.cel-gift-reward [data-cel-count]');
      if (reward) reward.dataset.celCount = String(Number(res.coins));
      $('.cel-gift-reward .cel-reward')?.setAttribute('aria-label', `${num(res.coins)} 코인`);
      const count = $('.cel-gift-count');
      if (count && Array.isArray(res.gifts)) { count.textContent = `선물 ${res.gifts.length}개`; count.hidden = res.gifts.length < 2; }
    }
    stage.dataset.state = 'open';
    buzz([30, 50, 30, 50, 120]);
    $('.cel-gift-title').textContent = '코인 선물 받았어요!';
    $('.cel-gift-reward').hidden = false;
    coinShower($('.cel-gift'), 26, 2);
    playReward($('.cel-gift'), 420);
    button.innerHTML = '고마워요!';
    button.disabled = false;
    button.onclick = () => { $('#modal-root').innerHTML = ''; done?.(); };
    button.focus({ preventScroll: true });
  };
  button.onclick = open;
  $('[data-gift-open]').onclick = open;
  button.focus({ preventScroll: true });
}
