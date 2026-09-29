import { CHARACTERS, PET_FORMS } from './core.js';
// Illustrated pets: /assets/pets/<pet>-<form>.webp (512px, transparent, feet on a shared
// baseline) plus a 160px `-s` copy for small avatars. `form` is 0 (egg) .. 3 (final).
const LEGACY = { lumi:'dog', nox:'cat', blaze:'dog', tide:'cat', zeph:'dragon', terra:'panda' };
// V13.65: 몽이's growing and final art were redrawn (the body grows); its old happy face
// belonged to the previous drawing, so it is left out until a matching one is drawn.
const EXPRESSIONS = { pig: { 2: ['happy'] } };
// Sprites are fitted one by one, so growth is added back gently (feet stay anchored).
const GROW = [.86, .86, .93, 1];
const SMALL = new Set(['mini']);
// V13.63: run cycles (/assets/pets/<pet>-<form>-run.webp, six 512px frames side by side, fitted
// to the still sprite). Pets listed here run when tapped on the home card; the rest hop.
export const RUN_SHEETS = new Set(['dog-1']);
// Accessories are earned rewards; on illustrated pets they show as a badge, not on the head.
const ACCESSORY_ICONS = {
  headset: '<path d="M5 14v-2a7 7 0 0 1 14 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1.6"/><rect x="16.5" y="13" width="4" height="6" rx="1.6"/>',
  glasses: '<circle cx="7.5" cy="13" r="3.5"/><circle cx="16.5" cy="13" r="3.5"/><path d="M11 12.5h2"/>',
  starpin: '<path d="m12 4 2.3 5 5.2.6-3.9 3.6 1.1 5.3L12 15.8 7.3 18.5l1.1-5.3-3.9-3.6 5.2-.6z"/>',
  visor: '<path d="M4 11q8-5 16 0l-1.5 4.5q-6.5-3-13 0z"/>',
  crown: '<path d="m4 17 1.5-9 4 3.5L12 6l2.5 5.5 4-3.5 1.5 9z"/><path d="M5 19.5h14"/>'
};
// V13.67 capsule badges: filled, in their own colors (class gb-<key>).
export const GACHA_BADGE_ICONS = {
  g_heart: '<path d="M12 20.5 4.6 13.3A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 7.4 6.1z"/>',
  g_note: '<path d="M9 17.5V6.2l10-2.2v11.3"/><circle cx="6.6" cy="17.6" r="2.6"/><circle cx="16.6" cy="15.4" r="2.6"/>',
  g_clover: '<circle cx="9" cy="9" r="3.4"/><circle cx="15" cy="9" r="3.4"/><circle cx="9" cy="15" r="3.4"/><circle cx="15" cy="15" r="3.4"/><path d="M12 12c1 3 2.5 6 5 8" fill="none" stroke-width="1.8"/>',
  g_cloud: '<path d="M7.5 18.5a4 4 0 0 1-.6-8 5.3 5.3 0 0 1 10.2-1.3 4.7 4.7 0 0 1 .4 9.3z"/>',
  g_candy: '<circle cx="12" cy="12" r="4.6"/><path d="m7.8 9.6-4.3-2.4.6 4.8zM16.2 14.4l4.3 2.4-.6-4.8z"/>',
  g_rocket: '<path d="M12 2.8c3.4 2.4 5 6 4.5 10.4L14 16h-4l-2.5-2.8C7 8.8 8.6 5.2 12 2.8z"/><path d="m8.4 13.8-2.9 2.4 2 3.3 3-2.3zM15.6 13.8l2.9 2.4-2 3.3-3-2.3z"/><circle cx="12" cy="9" r="1.7" fill="#fff"/>',
  g_gem: '<path d="M7 4h10l4 5.5L12 21 3 9.5z"/><path d="M3 9.5h18M9.5 4 8 9.5l4 11.5 4-11.5L14.5 4" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.1"/>',
  g_rainbow: '<path d="M2.5 17a9.5 9.5 0 0 1 19 0h-3a6.5 6.5 0 0 0-13 0z"/><path d="M6.8 17a5.2 5.2 0 0 1 10.4 0" fill="none" stroke-width="2"/>'
};

// V13.67: pets nobody can own (the practice match's robot). Same art layout as the others.
export const SPECIAL_PETS = { robot: { ko: '로보', type: '연습 상대', color: '#39c4ad', soft: '#e1f7f2' } };
export function petKey(key) { return CHARACTERS[key] || SPECIAL_PETS[key] ? key : (LEGACY[key] || 'dog'); }

export function avatar(key = 'dog', options = {}) {
  key = petKey(key);
  const c = CHARACTERS[key] || SPECIAL_PETS[key];
  const { size = '', form: rawForm = 1, accessory = 'none', frame = 'basic', expression = 'normal' } = options;
  const form = Math.max(0, Math.min(3, Math.round(Number(rawForm)) || 0));
  const small = SMALL.has(size);
  const expr = expression === 'win' ? 'happy' : expression;
  const hasExpr = !small && expr !== 'normal' && (EXPRESSIONS[key]?.[form] || []).includes(expr);
  const src = `/assets/pets/${key}-${form}${hasExpr ? '-' + expr : ''}${small ? '-s' : ''}.webp`;
  const label = `${c.ko}, ${PET_FORMS[form]}`;
  const badge = small ? '' : ACCESSORY_ICONS[accessory] ? `<span class="pet-acc-badge" aria-hidden="true"><svg viewBox="0 0 24 24">${ACCESSORY_ICONS[accessory]}</svg></span>`
    : GACHA_BADGE_ICONS[accessory] ? `<span class="pet-acc-badge gacha gb-${accessory}" aria-hidden="true"><svg viewBox="0 0 24 24">${GACHA_BADGE_ICONS[accessory]}</svg></span>` : '';
  const run = !small && RUN_SHEETS.has(`${key}-${form}`) ? ` data-run="/assets/pets/${key}-${form}-run.webp"` : '';
  return `<div class="avatar-art avatar-premium avatar-img avatar-form-${form} frame-${frame} expr-${expression} ${size}"${run} style="--avatar:${c.color};--avatar-soft:${c.soft};--pet-grow:${GROW[form]}"><img src="${src}" alt="${label}" width="${small ? 160 : 512}" height="${small ? 160 : 512}" decoding="async"${small ? ' loading="lazy"' : ''} draggable="false">${badge}</div>`;
}
