export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = n => Number(n || 0).toLocaleString('ko-KR');
export const date = n => new Date(n).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });
export const time = n => `${Math.floor(Math.max(0, n) / 60)}:${String(Math.floor(Math.max(0, n) % 60)).padStart(2, '0')}`;
export const rangeLabel = (school, code) => school === '선부고' ? `외부 ${code}` : `${code}번`;
export const recordRangeLabel = (context, code) => context?.division === 'middle' ? `${code}과` : rangeLabel(context?.school, code);
export const scope = e => (e.range_codes || []).map(c => recordRangeLabel(e, c)).join(' · ');
const paths = {
  home: '<path d="m3 10 9-7 9 7v10H4V10"/><path d="M9 20v-7h6v7"/>',
  practice: '<path d="M4 4h6q2 0 2 2v15q-1-3-4-3H4zM20 4h-6q-2 0-2 2v15q1-3 4-3h4z"/>',
  exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
  ranking: '<path d="M4 20v-8h5v8M9 20V5h6v15M15 20v-11h5v11"/>',
  records: '<path d="M5 4h14v17H5zM9 9h6M9 13h6M9 17h3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8M17 3q11 9 0 18"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M17 15l5-6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  flame: '<path d="M13 3c1 7 7 7 6 12a7 7 0 0 1-14 0c0-4 3-6 4-8 0 3 2 3 2 3z"/>',
  star: '<path d="m12 3 3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
  logout: '<path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  leaf: '<path d="M20 4C9 1 1 8 6 16s17 0 14-12ZM6 18 17 7"/>',
  shield: '<path d="m12 3 8 3v6q0 6-8 9-8-3-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  sparkle: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
export const empty = (name, title, sub = '') => `<div class="empty-state">${icon(name)}<h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
export function toast(message) { const t = $('#toast'); t.textContent = message; t.classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('visible'), 3200); }
export async function api(path, body, method) {
  const requestMethod = method || (body === undefined ? 'GET' : 'POST');
  const attempts = requestMethod === 'GET' ? 2 : 1;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch('/api' + path, { method: requestMethod, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      let data = {};
      try { data = await r.json(); } catch {}
      if (!r.ok) {
        const error = Object.assign(new Error(data.error || '연결을 확인해주세요.'), { status: r.status, transient: r.status >= 500 });
        if (requestMethod === 'GET' && error.transient && attempt + 1 < attempts) { lastError = error; await new Promise(resolve => setTimeout(resolve, 220)); continue; }
        throw error;
      }
      return data;
    } catch (error) {
      const transient = error?.name === 'AbortError' || error instanceof TypeError || error?.status >= 500;
      lastError = Object.assign(error instanceof Error ? error : new Error('연결을 확인해주세요.'), { status: Number(error?.status || 0), transient });
      if (requestMethod === 'GET' && transient && attempt + 1 < attempts) { await new Promise(resolve => setTimeout(resolve, 220)); continue; }
      throw lastError;
    } finally { clearTimeout(timer); }
  }
  throw lastError || Object.assign(new Error('연결을 확인해주세요.'), { status: 0, transient: true });
}
export function buttonBusy(button, busy = true) { if (!button) return; button.disabled = busy; button.classList.toggle('busy', busy); }
export function modal(content, title = '안내') {
  const prior = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="icon-button modal-close" data-close aria-label="닫기">${icon('close')}</button>${content}</section></div>`;
  const close = () => { $('#modal-root').innerHTML = ''; prior?.focus?.(); };
  $('[data-close]').onclick = close;
  $('.modal-backdrop').onclick = e => { if (e.target.classList.contains('modal-backdrop')) close(); };
  $('.modal').onkeydown = e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { const nodes = $$('button:not(:disabled),input,select,textarea,[tabindex="0"]', $('.modal')); const first = nodes[0], last = nodes.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  };
  $('[data-close]').focus(); return close;
}
export const field = (label, name, input) => `<label class="field"><span>${label}</span>${input || `<input name="${name}" required>`}</label>`;
