import { CHARACTERS, PET_FORMS } from './core.js';
// Illustrated pets: /assets/pets/<pet>-<form>.webp (512px, transparent, feet on a shared
// baseline) plus a 160px `-s` copy for small avatars. `form` is 0 (egg) .. 3 (final).
const LEGACY = { lumi:'dog', nox:'cat', blaze:'dog', tide:'cat', zeph:'dragon', terra:'panda' };
const EXPRESSIONS = { dog: { 2: ['happy'] }, pig: { 2: ['happy'] } };
// Sprites are fitted one by one, so growth is added back gently (feet stay anchored).
const GROW = [.86, .86, .93, 1];
const SMALL = new Set(['mini']);
// Accessories are earned rewards; on illustrated pets they show as a badge, not on the head.
const ACCESSORY_ICONS = {
  headset: '<path d="M5 14v-2a7 7 0 0 1 14 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1.6"/><rect x="16.5" y="13" width="4" height="6" rx="1.6"/>',
  glasses: '<circle cx="7.5" cy="13" r="3.5"/><circle cx="16.5" cy="13" r="3.5"/><path d="M11 12.5h2"/>',
  starpin: '<path d="m12 4 2.3 5 5.2.6-3.9 3.6 1.1 5.3L12 15.8 7.3 18.5l1.1-5.3-3.9-3.6 5.2-.6z"/>',
  visor: '<path d="M4 11q8-5 16 0l-1.5 4.5q-6.5-3-13 0z"/>',
  crown: '<path d="m4 17 1.5-9 4 3.5L12 6l2.5 5.5 4-3.5 1.5 9z"/><path d="M5 19.5h14"/>'
};

export function petKey(key) { return CHARACTERS[key] ? key : (LEGACY[key] || 'dog'); }

export function avatar(key = 'dog', options = {}) {
  key = petKey(key);
  const c = CHARACTERS[key];
  const { size = '', form: rawForm = 1, accessory = 'none', frame = 'basic', expression = 'normal' } = options;
  const form = Math.max(0, Math.min(3, Math.round(Number(rawForm)) || 0));
  const small = SMALL.has(size);
  const expr = expression === 'win' ? 'happy' : expression;
  const hasExpr = !small && expr !== 'normal' && (EXPRESSIONS[key]?.[form] || []).includes(expr);
  const src = `/assets/pets/${key}-${form}${hasExpr ? '-' + expr : ''}${small ? '-s' : ''}.webp`;
  const label = `${c.ko}, ${PET_FORMS[form]}`;
  const badge = !small && ACCESSORY_ICONS[accessory] ? `<span class="pet-acc-badge" aria-hidden="true"><svg viewBox="0 0 24 24">${ACCESSORY_ICONS[accessory]}</svg></span>` : '';
  return `<div class="avatar-art avatar-premium avatar-img avatar-form-${form} frame-${frame} expr-${expression} ${size}" style="--avatar:${c.color};--avatar-soft:${c.soft};--pet-grow:${GROW[form]}"><img src="${src}" alt="${label}" width="${small ? 160 : 512}" height="${small ? 160 : 512}" decoding="async"${small ? ' loading="lazy"' : ''} draggable="false">${badge}</div>`;
}
