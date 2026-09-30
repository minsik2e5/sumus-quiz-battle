// PIN gate shared by the planner and the widget. The first visit creates the PIN.
import { api } from './sync.js';

export async function ensureSignedIn(root, { compact = false } = {}) {
  const state = await api('/api/auth');
  if (state.authenticated) return true;
  return new Promise(resolve => {
    root.innerHTML = `<main class="gate ${compact ? 'compact' : ''}">
      <form class="gate-card" id="gate-form" autocomplete="off">
        <div class="gate-logo">S</div>
        <h1>${state.configured ? 'SUMUS 플래너' : 'PIN 만들기'}</h1>
        <p>${state.configured ? 'PIN을 입력해 주세요.' : '처음이에요. 앞으로 쓸 숫자 PIN(4~8자리)을 정해 주세요.'}</p>
        <input id="gate-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="PIN" aria-label="PIN" autofocus>
        ${state.configured ? '' : '<input id="gate-pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="PIN 한 번 더" aria-label="PIN 확인">'}
        <button class="btn primary" type="submit">${state.configured ? '들어가기' : 'PIN 만들고 시작'}</button>
        <div class="gate-error" id="gate-error" role="alert"></div>
      </form>
    </main>`;
    const form = root.querySelector('#gate-form'), err = root.querySelector('#gate-error');
    form.onsubmit = async event => {
      event.preventDefault();
      const pin = root.querySelector('#gate-pin').value.trim();
      const pin2 = root.querySelector('#gate-pin2')?.value.trim();
      if (!/^\d{4,8}$/.test(pin)) { err.textContent = 'PIN은 숫자 4~8자리예요.'; return; }
      if (!state.configured && pin !== pin2) { err.textContent = '두 PIN이 달라요.'; return; }
      const button = form.querySelector('button'); button.disabled = true; err.textContent = '';
      try { await api('/api/auth', { method: 'POST', body: JSON.stringify({ pin }) }); resolve(true); }
      catch (e) { err.textContent = e.message; button.disabled = false; }
    };
  });
}
export async function signOut() {
  try { await api('/api/auth', { method: 'DELETE' }); } catch {}
  location.reload();
}
