// Small UI helpers shared by the planner and the widget. The markup and class names are the ones
// of the original SUMUS Planner (shadcn/ui + Radix + lucide), so its stylesheet (style.css) applies
// as it did: icons, Button, Input, Textarea, Checkbox, Progress, Select, Dialog and the undo bar.
const P = {
  'archive': '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'book-open-check': '<path d="M12 5v16"/><path d="m16 12 2 2 4-4"/><path d="M22 6V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2h4.001A2 2 0 0022 17v-1.344"/>',
  'calendar-days': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'circle-plus': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
  'clock-3': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h8M8 9h2"/>',
  'cloud': '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  'cloud-off': '<path d="M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057"/><path d="M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78"/><path d="m2 2 20 20"/>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'download': '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  'ellipsis': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'gauge': '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'link-2': '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  'list-checks': '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
  'lock-keyhole': '<circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>',
  'log-out': '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  'monitor-up': '<path d="m9 10 3-3 3 3"/><path d="M12 13V7"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/>',
  'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  'sparkles': '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  'sticky-note': '<path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/>',
  'trash-2': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  'upload': '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};
// lucide-react markup (width/height 24, stroke 2, class "lucide lucide-<name>").
export const icon = (name, cls = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}${cls ? ' ' + cls : ''}" aria-hidden="true">${P[name] || ''}</svg>`;
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isImeEnter = e => e.key === 'Enter' && (e.isComposing || e.keyCode === 229);
export const isEnter = e => e.key === 'Enter' && !isImeEnter(e);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------ shadcn/ui components */
const SVG4 = "[&_svg:not([class*='size-'])]:size-4";
const BTN_BASE = 'inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0';
const BTN_VARIANT = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50'
};
const BTN_SIZE = {
  default: `gap-2 ${SVG4} h-9 px-4 py-2 has-[>svg]:px-3`,
  sm: `${SVG4} h-8 gap-1.5 px-3 has-[>svg]:px-2.5`,
  xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3"
};
export function button(inner, { variant = 'default', size = 'default', cls = '', attrs = '', type = 'button' } = {}) {
  return `<button type="${type}" data-slot="button" data-variant="${variant}" data-size="${size}" class="${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]}${cls ? ' ' + cls : ''}" ${attrs}>${inner}</button>`;
}
const INPUT = 'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';
export const input = (attrs = '', cls = '') => `<input data-slot="input" class="${INPUT}${cls ? ' ' + cls : ''}" ${attrs}>`;
const TEXTAREA = 'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40';
export const textarea = (value = '', attrs = '', cls = '') => `<textarea data-slot="textarea" class="${TEXTAREA}${cls ? ' ' + cls : ''}" ${attrs}>${esc(value)}</textarea>`;
const CHECKBOX = 'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary';
const checkMark = () => `<span data-state="checked" data-slot="checkbox-indicator" class="grid place-content-center text-current transition-none" style="pointer-events: none;">${icon('check', 'size-3.5')}</span>`;
// Radix Checkbox: a button[role=checkbox]; the page decides what a click changes.
export const checkbox = (checked, attrs = '') => `<button type="button" role="checkbox" aria-checked="${!!checked}" data-state="${checked ? 'checked' : 'unchecked'}" value="on" data-slot="checkbox" class="${CHECKBOX}" ${attrs}>${checked ? checkMark() : ''}</button>`;
export function setCheckbox(el, checked) {
  el.setAttribute('aria-checked', String(!!checked));
  el.dataset.state = checked ? 'checked' : 'unchecked';
  el.innerHTML = checked ? checkMark() : '';
}
export const isChecked = el => el.getAttribute('aria-checked') === 'true';
export function progress(value, cls = '') {
  const v = Math.max(0, Math.min(100, Number(value) || 0)), st = v === 100 ? 'complete' : 'loading';
  return `<div aria-valuemax="100" aria-valuemin="0" aria-valuenow="${v}" aria-valuetext="${v}%" role="progressbar" data-state="${st}" data-value="${v}" data-max="100" data-slot="progress" class="relative h-2 w-full overflow-hidden rounded-full bg-primary/20${cls ? ' ' + cls : ''}"><div data-state="${st}" data-value="${v}" data-max="100" data-slot="progress-indicator" class="h-full w-full flex-1 bg-primary transition-all" style="transform: translateX(-${100 - v}%);"></div></div>`;
}

/* ------------------------------------------------------------ Select (Radix look) */
const SELECT_TRIGGER = "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";
const SELECT_CONTENT = 'relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';
const SELECT_ITEM = "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2";
// options: [[value, label], ...]. The chosen value is kept in data-value; choosing another one
// fires a bubbling "selectchange" event ({ detail: { value } }) on the trigger.
export function select({ value = '', options = [], placeholder = '', attrs = '', cls = '' }) {
  const hit = options.find(([v]) => v === value);
  return `<button type="button" role="combobox" aria-expanded="false" aria-autocomplete="none" dir="ltr" data-state="closed"${hit ? '' : ' data-placeholder=""'} data-slot="select-trigger" data-size="default" class="${SELECT_TRIGGER}${cls ? ' ' + cls : ''}" data-value="${esc(hit ? value : '')}" data-options="${esc(JSON.stringify(options))}" data-ph="${esc(placeholder)}" ${attrs}><span data-slot="select-value" style="pointer-events: none;">${esc(hit ? hit[1] : placeholder)}</span>${icon('chevron-down', 'size-4 opacity-50')}</button>`;
}
export function setSelect(trigger, value) {
  const options = JSON.parse(trigger.dataset.options || '[]'), hit = options.find(([v]) => v === value);
  trigger.dataset.value = hit ? value : '';
  if (hit) trigger.removeAttribute('data-placeholder'); else trigger.setAttribute('data-placeholder', '');
  trigger.querySelector('[data-slot=select-value]').textContent = hit ? hit[1] : trigger.dataset.ph || '';
}
let openSel = null;
function closeSelect(focusTrigger = true) {
  if (!openSel) return;
  const { layer, trigger } = openSel; openSel = null;
  layer.remove();
  trigger.setAttribute('aria-expanded', 'false'); trigger.dataset.state = 'closed';
  if (focusTrigger && trigger.isConnected) trigger.focus({ preventScroll: true });
}
function openSelect(trigger) {
  closeSelect(false);
  const options = JSON.parse(trigger.dataset.options || '[]'), value = trigger.dataset.value || '';
  const layer = document.createElement('div');
  layer.innerHTML = `<div data-select-backdrop style="position:fixed;inset:0;z-index:50"></div><div style="display:flex;flex-direction:column;position:fixed;z-index:50;left:0;top:0;visibility:hidden"><div role="listbox" dir="ltr" data-slot="select-content" class="${SELECT_CONTENT}" tabindex="-1" style="box-sizing:border-box;display:flex;flex-direction:column;outline:none;max-height:100%"><div data-radix-select-viewport="" role="presentation" class="p-1" style="position:relative;flex:1;overflow:hidden auto">${options.map(([v, l]) => `<div role="option" aria-selected="${v === value}" data-state="${v === value ? 'checked' : 'unchecked'}" tabindex="-1" data-slot="select-item" data-opt="${esc(v)}" class="${SELECT_ITEM}"><span data-slot="select-item-indicator" class="absolute right-2 flex size-3.5 items-center justify-center">${v === value ? icon('check', 'size-4') : ''}</span><span>${esc(l)}</span></div>`).join('')}</div></div></div>`;
  document.body.appendChild(layer);
  const pos = layer.children[1], content = pos.firstElementChild, items = $$('[role=option]', content);
  const r = trigger.getBoundingClientRect(), val = trigger.querySelector('[data-slot=select-value]').getBoundingClientRect();
  const cur = items.find(i => i.dataset.opt === value) || items[0];
  // item-aligned (Radix default): the chosen item sits over the trigger, its text on the trigger's text.
  const cr = content.getBoundingClientRect(), txt = cur ? cur.lastElementChild.getBoundingClientRect() : cr;
  let left = val.left - (txt.left - cr.left);
  const width = Math.max(cr.width, r.right - left);
  left = Math.min(Math.max(10, left), innerWidth - width - 10);
  const itemMid = cur ? cur.getBoundingClientRect().top - cr.top + cur.offsetHeight / 2 : 0;
  const h = Math.min(cr.height, innerHeight - 20);
  const top = Math.min(Math.max(10, r.top + r.height / 2 - itemMid), innerHeight - h - 10);
  Object.assign(pos.style, { left: left + 'px', top: top + 'px', minWidth: width + 'px', height: h + 'px', visibility: 'visible' });
  trigger.setAttribute('aria-expanded', 'true'); trigger.dataset.state = 'open'; content.dataset.state = 'open'; // measured first, then the open animation
  openSel = { layer, trigger };
  (cur || content).focus({ preventScroll: true });
  const choose = v => {
    closeSelect();
    if (v !== trigger.dataset.value) { setSelect(trigger, v); trigger.dispatchEvent(new CustomEvent('selectchange', { bubbles: true, detail: { value: v } })); }
  };
  layer.firstElementChild.addEventListener('pointerdown', e => { e.preventDefault(); closeSelect(); });
  content.addEventListener('pointermove', e => { const it = e.target.closest('[role=option]'); if (it && document.activeElement !== it) it.focus({ preventScroll: true }); });
  content.addEventListener('click', e => { const it = e.target.closest('[role=option]'); if (it) choose(it.dataset.opt); });
  content.addEventListener('keydown', e => {
    e.stopPropagation();
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeSelect(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, i - 1)]?.focus(); }
    else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); choose(items[i].dataset.opt); }
  });
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-slot=select-trigger]');
  if (t && !t.disabled) { e.preventDefault(); openSelect(t); }
});
document.addEventListener('keydown', e => {
  const t = e.target.closest?.('[data-slot=select-trigger]');
  if (t && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); e.stopPropagation(); openSelect(t); }
}, true);
addEventListener('resize', () => closeSelect(false));

/* ------------------------------------------------------------ Dialog (Radix look) */
const OVERLAY = 'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0';
const CONTENT = 'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg';
const CLOSE = "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const dialogs = [];
// dialog(titleHtml, bodyHtml, { cls }) -> { el, close }. Esc, the overlay, the X and [data-close] close it.
export function dialog(titleHtml, bodyHtml, { cls = 'task-dialog', onClose } = {}) {
  const host = document.createElement('div');
  host.innerHTML = `<div data-state="open" data-slot="dialog-overlay" class="${OVERLAY}" style="pointer-events: auto;" aria-hidden="true"></div><div role="dialog" aria-modal="true" data-state="open" data-slot="dialog-content" class="${CONTENT} ${cls}" tabindex="-1" style="pointer-events: auto;"><div data-slot="dialog-header" class="flex flex-col gap-2 text-center sm:text-left"><h2 data-slot="dialog-title" class="text-lg leading-none font-semibold">${titleHtml}</h2></div>${bodyHtml}<button type="button" data-slot="dialog-close" class="${CLOSE}">${icon('x')}<span class="sr-only">Close</span></button></div>`;
  document.body.appendChild(host);
  const el = host.children[1];
  const close = () => { if (!host.isConnected) return; closeSelect(false); host.remove(); dialogs.splice(dialogs.indexOf(close), 1); onClose?.(); };
  dialogs.push(close);
  host.firstElementChild.addEventListener('pointerdown', e => { e.preventDefault(); close(); });
  el.addEventListener('click', e => { if (e.target.closest('[data-close], [data-slot=dialog-close]')) close(); });
  // Like Radix: an autofocus field gets the focus; otherwise the first field, with its text selected.
  const auto = el.querySelector('[autofocus]'), first = auto || el.querySelector('input:not([type=hidden]):not([disabled]), textarea, button:not([disabled])');
  (first || el).focus({ preventScroll: true });
  if (!auto && first?.tagName === 'INPUT') try { first.select(); } catch {}
  return { el, close };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && dialogs.length) { e.preventDefault(); dialogs[dialogs.length - 1](); } });

/* ------------------------------------------------------------ undo bar, notice */
let undoTimer = null;
export function undoBar(message, restore) {
  document.querySelector('.undo-bar:not(.sumus-notice)')?.remove();
  clearTimeout(undoTimer);
  const bar = document.createElement('div');
  bar.className = 'undo-bar';
  bar.innerHTML = `<span>${esc(message)}</span><button type="button" data-undo>되돌리기</button><button type="button" class="undo-close" aria-label="닫기">×</button>`;
  document.body.appendChild(bar);
  const hide = () => { bar.remove(); clearTimeout(undoTimer); };
  bar.querySelector('[data-undo]').onclick = () => { restore(); hide(); };
  bar.querySelector('.undo-close').onclick = hide;
  undoTimer = setTimeout(hide, 8000);
}
// A short notice in the undo bar's look, for things the page did by itself.
export function toast(message) {
  document.querySelector('.sumus-notice')?.remove();
  const bar = document.createElement('div');
  bar.className = 'undo-bar sumus-notice';
  bar.innerHTML = `<span>${esc(message)}</span><button type="button" class="undo-close" aria-label="닫기">×</button>`;
  document.body.appendChild(bar);
  const t = setTimeout(() => bar.remove(), 4000);
  bar.querySelector('.undo-close').onclick = () => { clearTimeout(t); bar.remove(); };
}
