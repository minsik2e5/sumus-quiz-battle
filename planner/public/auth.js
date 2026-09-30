// PIN gate shared by the planner and the widget (the original "pin-page" screen).
// The very first visit creates the PIN.
import { api } from './sync.js';
import { icon, esc } from './ui.js';

const BRAND = '<div class="pin-brand"><span>S</span><div><strong>SUMUS</strong><small>PLANNER</small></div></div>';
// The waiting screen: with the brand while checking the sign-in, without it while loading data.
export const pinChecking = (text, withBrand = false) => `<main class="pin-page"><section class="pin-card">${withBrand ? BRAND : ''}<div class="pin-checking"><span></span><p>${esc(text)}</p></div></section></main>`;

export async function ensureSignedIn(root) {
  const state = await api('/api/auth');
  if (state.authenticated) return true;
  const create = !state.configured;
  return new Promise(resolve => {
    root.innerHTML = `<main class="pin-page"><section class="pin-card">${BRAND}
      <div class="pin-icon">${icon('lock-keyhole')}</div>
      <h1>${create ? 'PIN 만들기' : '선생님, 반가워요'}</h1>
      <p>${create ? '처음이에요. 앞으로 쓸 숫자 PIN(4~8자리)을 정해 주세요.' : '플래너를 열려면 PIN을 입력해주세요.'}</p>
      <form id="gate-form" autocomplete="off">
        <label>${create ? '새 PIN' : '접속 PIN'}<input id="gate-pin" autofocus type="password" inputmode="numeric" autocomplete="${create ? 'new-password' : 'current-password'}" maxlength="8" placeholder="${create ? '숫자 4~8자리' : '숫자 PIN'}"></label>
        ${create ? '<label>PIN 확인<input id="gate-pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="한 번 더 입력"></label>' : ''}
        <span class="pin-error" id="gate-error" hidden></span>
        <button id="gate-submit" disabled>${create ? 'PIN 만들고 시작' : '플래너 열기'}</button>
      </form>
      <small class="pin-note">개인 일정과 수업 기록을 안전하게 보호합니다.</small>
    </section></main>`;
    const form = root.querySelector('#gate-form'), err = root.querySelector('#gate-error'), btn = root.querySelector('#gate-submit');
    const pin = root.querySelector('#gate-pin'), pin2 = root.querySelector('#gate-pin2');
    let busy = false;
    const showError = text => { err.textContent = text; err.hidden = !text; };
    const sync = () => { btn.disabled = !pin.value || busy; };
    for (const el of [pin, pin2].filter(Boolean)) el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, ''); showError(''); sync(); });
    pin.focus();
    form.onsubmit = async event => {
      event.preventDefault();
      if (!pin.value || busy) return;
      if (!/^\d{4,8}$/.test(pin.value)) return showError('PIN은 숫자 4~8자리예요.');
      if (create && pin.value !== pin2.value) return showError('두 PIN이 달라요.');
      busy = true; sync(); showError(''); btn.textContent = '확인 중…';
      try { await api('/api/auth', { method: 'POST', body: JSON.stringify({ pin: pin.value }) }); resolve(true); return; }
      catch (e) { showError(e.status ? e.message : '연결을 확인하고 다시 시도해주세요.'); }
      busy = false; sync(); btn.textContent = create ? 'PIN 만들고 시작' : '플래너 열기';
    };
  });
}
export async function signOut() {
  try { await api('/api/auth', { method: 'DELETE' }); } catch {}
  location.reload();
}
