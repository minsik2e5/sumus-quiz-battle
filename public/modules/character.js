import { CHARACTERS, PET_FORMS } from './core.js';
// Illustrated pets: /assets/pets/<pet>-<form>.webp (512px, transparent, feet on a shared
// baseline) plus a 160px `-s` copy for small avatars. `form` is 0 (egg) .. 3 (final).
const LEGACY = { lumi:'dog', nox:'cat', blaze:'dog', tide:'cat', zeph:'dragon', terra:'panda' };
// V13.84 expressions (/assets/pets/<pet>-<form>-<expr>.webp, fitted to the still sprite):
// happy (petting, wins), eat (feeding), sad (losses, a long absence), cheer (attacking, starting).
// A pose not drawn yet falls back to the still sprite.
const ALL = ['happy', 'eat', 'sad', 'cheer'];
const EXPRESSIONS = {
  dog: { 1: ALL, 2: ALL, 3: ALL },
  pig: { 1: ALL, 2: ALL, 3: ALL },
  cat: { 1: ALL, 2: ALL, 3: ALL },
  dragon: { 1: ALL, 2: ALL, 3: ALL },
  panda: { 1: ALL, 2: ALL, 3: ALL },
  snake: { 1: ALL, 2: ALL, 3: ALL },
  rabbit: { 1: ALL, 2: ALL, 3: ALL },
  fox: { 1: ALL, 2: ALL, 3: ALL }
};
const EXPR_ALIAS = { win: 'happy', hurt: 'sad', lose: 'sad', feed: 'eat', pet: 'happy', attack: 'cheer' };
// The art of a pet's pose, or null when that pose is not drawn (callers keep the still sprite).
export function expressionSrc(key, form, expression) {
  const k = petKey(key), f = Math.max(0, Math.min(3, Math.round(Number(form)) || 0)), e = EXPR_ALIAS[expression] || expression;
  return (EXPRESSIONS[k]?.[f] || []).includes(e) ? `/assets/pets/${k}-${f}-${e}.webp` : null;
}
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

// V13.67: pets nobody can own (the practice match's robot). Same art layout as the others.
export const SPECIAL_PETS = { robot: { ko: '로보', type: '연습 상대', color: '#39c4ad', soft: '#e1f7f2' } };
export function petKey(key) { return CHARACTERS[key] || SPECIAL_PETS[key] ? key : (LEGACY[key] || 'dog'); }

export function avatar(key = 'dog', options = {}) {
  key = petKey(key);
  const c = CHARACTERS[key] || SPECIAL_PETS[key];
  const { size = '', form: rawForm = 1, accessory = 'none', frame = 'basic', expression = 'normal' } = options;
  const form = Math.max(0, Math.min(3, Math.round(Number(rawForm)) || 0));
  const small = SMALL.has(size);
  const expr = EXPR_ALIAS[expression] || expression;
  const hasExpr = !small && expr !== 'normal' && (EXPRESSIONS[key]?.[form] || []).includes(expr);
  const src = `/assets/pets/${key}-${form}${hasExpr ? '-' + expr : ''}${small ? '-s' : ''}.webp`;
  const label = `${c.ko}, ${PET_FORMS[form]}`;
  const badge = !small && ACCESSORY_ICONS[accessory] ? `<span class="pet-acc-badge" aria-hidden="true"><svg viewBox="0 0 24 24">${ACCESSORY_ICONS[accessory]}</svg></span>` : '';
  const run = !small && RUN_SHEETS.has(`${key}-${form}`) ? ` data-run="/assets/pets/${key}-${form}-run.webp"` : '';
  return `<div class="avatar-art avatar-premium avatar-img avatar-form-${form} frame-${frame} expr-${expression} ${size}"${run} style="--avatar:${c.color};--avatar-soft:${c.soft};--pet-grow:${GROW[form]}"><img src="${src}" alt="${label}" width="${small ? 160 : 512}" height="${small ? 160 : 512}" decoding="async"${small ? ' loading="lazy"' : ''} draggable="false">${badge}</div>`;
}
