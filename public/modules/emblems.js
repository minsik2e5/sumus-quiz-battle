import { esc } from './ui.js';
import { TITLES, TITLE_TIERS, LEAGUE_TIERS } from './titles.js';

// V13.66 drawn emblems: title medals (a shape per tier), title chips, league tier shields and
// the coin. Gradients are defined once in a hidden <svg> and shared by every emblem.

const DEFS = `<svg id="sumus-emblem-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
  <linearGradient id="tt-g-common" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7f6ee"/><stop offset=".55" stop-color="#9fd0b7"/><stop offset="1" stop-color="#5f9c80"/></linearGradient>
  <linearGradient id="tt-r-common" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ab8a2"/><stop offset="1" stop-color="#3f6f5a"/></linearGradient>
  <linearGradient id="tt-g-rare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ecff"/><stop offset=".5" stop-color="#5aa2f8"/><stop offset="1" stop-color="#1f5fd6"/></linearGradient>
  <linearGradient id="tt-r-rare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cc9ff"/><stop offset=".5" stop-color="#2f6fe0"/><stop offset="1" stop-color="#173f9c"/></linearGradient>
  <linearGradient id="tt-g-epic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1e3ff"/><stop offset=".5" stop-color="#a878f5"/><stop offset="1" stop-color="#6230c9"/></linearGradient>
  <linearGradient id="tt-r-epic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcbcff"/><stop offset=".5" stop-color="#7b3fe4"/><stop offset="1" stop-color="#43188f"/></linearGradient>
  <linearGradient id="tt-g-legendary" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#ffd95a"/><stop offset=".75" stop-color="#f0a500"/><stop offset="1" stop-color="#b86f00"/></linearGradient>
  <linearGradient id="tt-r-legendary" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#e2a100"/><stop offset=".7" stop-color="#ffe27a"/><stop offset="1" stop-color="#9a5b00"/></linearGradient>
  <linearGradient id="tt-g-limited" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ac0"/><stop offset=".28" stop-color="#ffd76a"/><stop offset=".52" stop-color="#6ff2c5"/><stop offset=".76" stop-color="#6fb4ff"/><stop offset="1" stop-color="#b98bff"/></linearGradient>
  <linearGradient id="tt-r-limited" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2d6e"/><stop offset="1" stop-color="#171033"/></linearGradient>
  <linearGradient id="tt-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="lg-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c79a"/><stop offset=".45" stop-color="#c47a3c"/><stop offset=".7" stop-color="#e3a066"/><stop offset="1" stop-color="#7c4418"/></linearGradient>
  <linearGradient id="lg-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#aeb8c2"/><stop offset=".7" stop-color="#e4e9ee"/><stop offset="1" stop-color="#6c7883"/></linearGradient>
  <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#e9a800"/><stop offset=".7" stop-color="#ffd84f"/><stop offset="1" stop-color="#9c6200"/></linearGradient>
  <linearGradient id="lg-diamond" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9fdff"/><stop offset=".4" stop-color="#6fd6ff"/><stop offset=".7" stop-color="#b9a8ff"/><stop offset="1" stop-color="#3a6fe8"/></linearGradient>
</defs></svg>`;
export function ensureEmblemDefs() {
  if (typeof document === 'undefined' || document.getElementById('sumus-emblem-defs')) return;
  document.body.insertAdjacentHTML('afterbegin', DEFS);
}
ensureEmblemDefs();

// White glyphs on a 24 grid.
const GLYPHS = {
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4.2 2.6-6.6 7-6.6 0 4.2-2.8 6.6-7 6.6z" fill="#fff" fill-opacity=".28"/><path d="M12 14.5c0-3.3-2.2-5.4-6-5.4 0 3.3 2.3 5.4 6 5.4z" fill="#fff" fill-opacity=".28"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.2" fill="#fff"/>',
  flame: '<path d="M12 3c1 4.6 6 6 6 11a6 6 0 0 1-12 0c0-3 1.8-4.8 3-6 0 2 1 3.2 2.2 3.2C11.2 8 11.3 5.6 12 3z" fill="#fff" fill-opacity=".25"/>',
  star: '<path d="m12 3.2 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.9-5.3 2.9 1-6-4.3-4.2 6-.9z" fill="#fff" fill-opacity=".3"/>',
  sword: '<path d="M20.5 3.5 19.4 8 10.6 16.8 7.2 13.4 16 4.6z" fill="#fff" fill-opacity=".3"/><path d="m5.6 11.9 6.5 6.5M8.9 15.1l-4.2 4.2"/><circle cx="4" cy="20" r="1.3" fill="#fff"/>',
  book: '<path d="M4 5.5h5.6A2.4 2.4 0 0 1 12 7.9V20a2.2 2.2 0 0 0-2.2-2.2H4z"/><path d="M20 5.5h-5.6A2.4 2.4 0 0 0 12 7.9V20a2.2 2.2 0 0 1 2.2-2.2H20z"/>',
  bolt: '<path d="M13.4 2.5 4.5 13.6h6.6l-1 7.9 8.9-11.2h-6.6z" fill="#fff" fill-opacity=".3"/>',
  paw: '<circle cx="6.6" cy="10.4" r="1.9" fill="#fff"/><circle cx="10" cy="6.4" r="1.9" fill="#fff"/><circle cx="14" cy="6.4" r="1.9" fill="#fff"/><circle cx="17.4" cy="10.4" r="1.9" fill="#fff"/><path d="M12 11.6c-3 0-5 3.1-5 5.3 0 1.8 1.4 2.9 3 2.4.9-.3 1.4-.6 2-.6s1.1.3 2 .6c1.6.5 3-.6 3-2.4 0-2.2-2-5.3-5-5.3z" fill="#fff"/>',
  gem: '<path d="M7 4.5h10l4 5-9 10.5L3 9.5z" fill="#fff" fill-opacity=".25"/><path d="M3 9.5h18M9 4.5l3 5 3-5M12 9.5V20"/>',
  shield: '<path d="M12 3.2 19.5 6v5.6c0 4.8-3.3 7.8-7.5 9.2-4.2-1.4-7.5-4.4-7.5-9.2V6z" fill="#fff" fill-opacity=".22"/><path d="m8.6 11.8 2.4 2.4 4.4-4.6"/>',
  crown: '<path d="m3.5 17.5 1.6-10 4.6 4 2.3-6 2.3 6 4.6-4 1.6 10z" fill="#fff" fill-opacity=".3"/><path d="M4.5 20.5h15"/>',
  heart: '<path d="M12 20s-7.2-4.4-7.2-10.1A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.2 2.3C19.2 15.6 12 20 12 20z" fill="#fff" fill-opacity=".3"/>',
  wing: '<path d="M12 18.5c-1.3-3.4-4.5-5.9-8.5-6.4 1.6-1.2 3.5-1.6 5.4-1.2C8 9.4 7.7 7.6 8.3 5.8c1.7 1.7 3 3.9 3.7 6.4.7-2.5 2-4.7 3.7-6.4.6 1.8.3 3.6-.6 5.1 1.9-.4 3.8 0 5.4 1.2-4 .5-7.2 3-8.5 6.4z" fill="#fff" fill-opacity=".3"/>',
  trophy: '<path d="M8 4h8v5.2a4 4 0 0 1-8 0z" fill="#fff" fill-opacity=".3"/><path d="M8 6H5.2a2.8 2.8 0 0 0 3 3.6M16 6h2.8a2.8 2.8 0 0 1-3 3.6M12 13.2V17M8.5 20.5h7M9.5 17h5"/>',
  // V13.73: 출석 titles.
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.4" fill="#fff" fill-opacity=".25"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="m9 15 2 2 4-4"/>',
  medal: '<path d="m8 3 4 6.2L16 3"/><circle cx="12" cy="15" r="5.6" fill="#fff" fill-opacity=".28"/><path d="m12 12.2.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z" fill="#fff"/>'
};
const glyph = (name, x = 16, y = 16, size = 32) => `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="#fff" stroke-width="${(2.1 * 24 / size).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name] || GLYPHS.star}</g>`;
const star = (cx, cy, r) => `<path d="M${cx} ${cy - r}l${r * .28} ${r * .72} ${r * .72} ${r * .28}-${r * .72} ${r * .28}-${r * .28} ${r * .72}-${r * .28}-${r * .72}-${r * .72}-${r * .28} ${r * .72}-${r * .28}z" fill="#fff"/>`;

// A medal on a 64 grid; the outline tells the tier at a glance.
function medal(tier, iconName) {
  const g = `url(#tt-g-${tier})`, r = `url(#tt-r-${tier})`;
  const mark = glyph(iconName);
  const shine = '<path d="M14 22c4-8 12-12 18-12s14 4 18 12" fill="none" stroke="url(#tt-shine)" stroke-width="7" stroke-linecap="round" opacity=".55"/>';
  if (tier === 'rare') return `<path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="${r}"/><path d="M32 8.5 52.2 20.2v23.6L32 55.5 11.8 43.8V20.2z" fill="${g}"/>${shine}${mark}`;
  if (tier === 'epic') return `<path d="M32 2.5 58 11v19.5C58 47 46 57.5 32 62 18 57.5 6 47 6 30.5V11z" fill="${r}"/><path d="M32 8 52.5 14.8v15.6c0 13-9.3 21.5-20.5 25.3-11.2-3.8-20.5-12.3-20.5-25.3V14.8z" fill="${g}"/><circle cx="32" cy="8" r="2.4" fill="#f4e6ff"/><circle cx="9" cy="14" r="1.8" fill="#f4e6ff"/><circle cx="55" cy="14" r="1.8" fill="#f4e6ff"/>${shine}${mark}`;
  if (tier === 'legendary') {
    const rays = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, a2 = a + Math.PI / 16, a3 = a - Math.PI / 16; const p = (ang, d) => `${(32 + Math.cos(ang) * d).toFixed(1)} ${(32 + Math.sin(ang) * d).toFixed(1)}`; return `${p(a3, 24)} ${p(a, 31)} ${p(a2, 24)}`; }).join(' ');
    return `<polygon points="${rays}" fill="${r}"/><circle cx="32" cy="32" r="23" fill="${r}"/><circle cx="32" cy="32" r="19.5" fill="${g}"/>${star(32, 6.5, 3.2)}${shine}${mark}`;
  }
  if (tier === 'limited') return `<path d="M17 44 11 60l8-3 5 6 5-15zM47 44l6 16-8-3-5 6-5-15z" fill="url(#tt-g-limited)" stroke="${r}" stroke-width="1.5"/><circle cx="32" cy="29" r="26" fill="${r}"/><circle cx="32" cy="29" r="21.5" fill="${g}"/><circle cx="32" cy="29" r="21.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" stroke-dasharray="2 3"/><g transform="translate(0 -3)">${mark}</g>`;
  return `<circle cx="32" cy="32" r="28" fill="${r}"/><circle cx="32" cy="32" r="23" fill="${g}"/><circle cx="32" cy="32" r="23" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>${shine}${mark}`;
}
// Big emblem (collection, pop-ups). opts: { size: 'sm'|'md'|'lg'|'xl', locked, preview }
// A locked title still shows its own medal, faded (locked) or in colour (preview), with a lock.
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
export function titleEmblem(key, opts = {}) {
  const t = TITLES[key] || TITLES.rookie;
  const locked = !!(opts.locked || opts.preview);
  return `<span class="tt-emblem tt-emblem-${opts.size || 'md'} tier-${t.tier}${opts.locked ? ' is-locked' : ''}${opts.preview ? ' is-preview' : ''}" aria-hidden="true"><svg viewBox="0 0 64 64">${medal(t.tier, t.icon)}</svg>${locked ? `<i class="tt-lock">${LOCK}</i>` : ''}</span>`;
}
// Title chip next to a name. opts: { size: 'xs'|'sm'|'md' }
export function titleBadge(key, opts = {}) {
  const t = TITLES[key];
  if (!t) return '';
  return `<span class="tt-chip tt-chip-${opts.size || 'sm'} tier-${t.tier}" title="${esc(TITLE_TIERS[t.tier].name)} 칭호 · ${esc(t.name)}"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[t.icon] || GLYPHS.star}</svg></i><b>${esc(t.name)}</b></span>`;
}
export const tierName = key => TITLE_TIERS[key]?.name || '';

// League tier shield: bronze one chevron, silver two, gold three and wings, diamond a gem.
// V13.67: league tiers are drawn emblems (/assets/ui/league-<tier>.webp; 96px copy for small sizes).
export function tierEmblem(key = 'bronze', opts = {}) {
  const tier = LEAGUE_TIERS.find(item => item.key === key) || LEAGUE_TIERS[0];
  const size = opts.size || 'md';
  return `<span class="lg-emblem lg-emblem-${size} lg-${tier.key}" role="img" aria-label="${tier.name}"><img src="/assets/ui/league-${tier.key}${size === 'lg' ? '' : '-s'}.webp" alt="" width="${size === 'lg' ? 256 : 96}" height="${size === 'lg' ? 256 : 96}" decoding="async" draggable="false"></span>`;
}
// The academy tournament trophy (drawn art).
export function trophy(size = 'md') {
  return `<span class="tn-trophy tn-trophy-${size}" aria-hidden="true"><img src="/assets/ui/trophy${size === 'lg' || size === 'xl' ? '' : '-s'}.webp" alt="" width="${size === 'lg' || size === 'xl' ? 256 : 96}" height="${size === 'lg' || size === 'xl' ? 256 : 96}" decoding="async" draggable="false"></span>`;
}

export const coin = (cls = '') => `<i class="coin-ico ${cls}" aria-hidden="true"></i>`;
