import { modal } from './ui.js';

// V13.131 bottom sheet: the app's one dialog (modal(): named, Tab stays inside, Escape and the
// backdrop close it, focus goes back) drawn as a sheet that rises from the bottom. The 야차전
// range picker, the code box and the friend list use it. `set(html)` redraws the body in place,
// so a tap inside the sheet does not move focus.
export function openSheet(body, label, { className = '', onClose } = {}) {
  const close = modal(`<div class="ya-sheet-body">${body}</div>`, label, { className: `ya-sheet ${className}`.trim(), onClose });
  const box = document.querySelector('#modal-root .ya-sheet');
  box.closest('.modal-backdrop')?.classList.add('ya-sheet-back');
  box.insertAdjacentHTML('afterbegin', '<i class="ya-sheet-grab" aria-hidden="true"></i>');
  const area = box.querySelector('.ya-sheet-body');
  return { close, box, set: html => { area.innerHTML = html; } };
}
