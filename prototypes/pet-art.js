import { CHARACTERS } from './core.js';
// SUMUS VOCA pet art v2 — drop-in replacement for avatar() in public/modules/character.js.
// Same signature and wrapper markup; adds real evolution forms and `expression`
// ('normal' | 'happy' | 'angry' | 'hurt' | 'win').
const PET_PALETTE = {
  dog:    { base:'#E9A961', shade:'#C98540', light:'#F8D39C', belly:'#FFF3DF', line:'#6E4424', ear:'#B06C34', accent:'#3D8BDB' },
  pig:    { base:'#F8B4B8', shade:'#E78D96', light:'#FFD7D8', belly:'#FFE9E9', line:'#A04E5C', ear:'#F09AA3', accent:'#7C5CE0' },
  cat:    { base:'#A3AAB5', shade:'#7F8795', light:'#D3D8DF', belly:'#F7F4EF', line:'#4A5262', ear:'#F5B7C3', accent:'#E0567A' },
  dragon: { base:'#6DC98F', shade:'#46A66D', light:'#A9E5BC', belly:'#F4E8B2', line:'#2E6B47', ear:'#F2C94C', accent:'#E3683C' },
  panda:  { base:'#FBFAF5', shade:'#DCDAD1', light:'#FFFFFF', belly:'#FFFFFF', line:'#2B2E31', ear:'#34383B', accent:'#2FAE6E' },
  snake:  { base:'#8DD46C', shade:'#63B04B', light:'#C4EFA0', belly:'#F5F1BA', line:'#2F6A2B', ear:'#5DA244', accent:'#F0A43A' }
};
const PET_LEGACY = { lumi:'dog', nox:'cat', blaze:'dog', tide:'cat', zeph:'dragon', terra:'panda' };
const PET_EYE = '#2A2230';
let petSeq = 0;

// Growth: an egg, then three evolution stages. `stage` in avatar() is 0..3.
export const PET_FORMS = ['알', '아기', '성장', '최종'];
export const PET_FORM_LEVELS = [1, 3, 10, 20]; // level at which each form starts
export const petForm = (level = 1) => PET_FORM_LEVELS.reduce((f, lv, i) => (level >= lv ? i : f), 0);
// Korean particle after a pet name: petJosa('초롱', '이', '가') -> '초롱이'.
export const petJosa = (word, withBatchim, without) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? withBatchim : without);
};

// Illustrated sprites (transparent WebP, 512x512, feet on a shared baseline), named
// `<pet>-<form>.webp` and `<pet>-<form>-<expression>.webp`.
// A pet listed here renders as images; anything missing falls back to the SVG below.
// Expressions without their own sprite reuse the form's normal sprite.
const PET_IMAGE_BASE = (typeof window !== 'undefined' && window.PET_IMAGE_BASE) || '/assets/pets/';
const PET_IMAGES = {
  dog: { forms: [0, 1, 2, 3], expressions: { 2: ['happy'] }, facing: 'right' },
  pig: { forms: [0, 1, 2, 3], expressions: { 2: ['happy'] }, facing: 'right' },
  cat: { forms: [0, 1, 2, 3], expressions: {}, facing: 'right' },
  dragon: { forms: [0, 1, 2, 3], expressions: {}, facing: 'right' },
  panda: { forms: [0, 1, 2, 3], expressions: {}, facing: 'right' },
  snake: { forms: [0, 1, 2, 3], expressions: {}, facing: 'right' },
  rabbit: { forms: [0, 1, 2, 3], expressions: {}, facing: 'right' },
  fox: { forms: [0, 1, 2, 3], expressions: {}, facing: 'right' }
};
function petImage(key, form, expression) {
  const set = PET_IMAGES[key];
  if (!set || !set.forms.includes(form)) return null;
  const expr = expression === 'win' ? 'happy' : expression;
  const hasExpr = expr !== 'normal' && (set.expressions[form] || []).includes(expr);
  return { src: `${PET_IMAGE_BASE}${key}-${form}${hasExpr ? '-' + expr : ''}.webp`, facing: set.facing };
}

function petDarken(hex, amt) {
  const v = parseInt(hex.slice(1), 16), f = x => Math.max(0, Math.min(255, Math.round(x * (1 + amt))));
  return '#' + [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(f).map(x => x.toString(16).padStart(2, '0')).join('');
}
const petStar = (x, y, r, fill, op = 1) =>
  `<path d="M${x} ${y - r}Q${x + r * .18} ${y - r * .18} ${x + r} ${y}Q${x + r * .18} ${y + r * .18} ${x} ${y + r}Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z" fill="${fill}" opacity="${op}"/>`;
const petMirror = svg => `<g transform="matrix(-1 0 0 1 200 0)">${svg}</g>`;

function petEyes(expr, panda) {
  const ink = panda ? '#FFFFFF' : PET_EYE;
  const one = (x, y, side) => {
    if (expr === 'happy' || expr === 'win')
      return `<path d="M${x - 8} ${y + 3}Q${x} ${y - 9} ${x + 8} ${y + 3}" fill="none" stroke="${ink}" stroke-width="4.2" stroke-linecap="round"/>`;
    if (expr === 'hurt') {
      const d = side < 0 ? `M${x - 7} ${y - 6}L${x + 5} ${y}L${x - 7} ${y + 6}` : `M${x + 7} ${y - 6}L${x - 5} ${y}L${x + 7} ${y + 6}`;
      return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const ry = expr === 'angry' ? 8.5 : 10.5;
    return (panda ? `<circle cx="${x}" cy="${y}" r="9.5" fill="#fff"/>` : '') +
      `<ellipse cx="${x}" cy="${y}" rx="${panda ? 6.4 : 8}" ry="${panda ? 7.2 : ry}" fill="${PET_EYE}"/>` +
      `<circle cx="${x - 2.6}" cy="${y - 3.4}" r="${panda ? 2.4 : 3.3}" fill="#fff"/>` +
      `<circle cx="${x + 2.6}" cy="${y + 3.4}" r="1.5" fill="#fff" opacity=".85"/>`;
  };
  let brows = '';
  if (expr === 'angry') brows = `<path d="M67 80L89 88M133 80L111 88" stroke="${ink}" stroke-width="4.2" stroke-linecap="round"/>`;
  if (expr === 'hurt') brows = `<path d="M70 83L88 79M130 83L112 79" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
  return one(80, 96, -1) + one(120, 96, 1) + brows;
}

function petMouth(expr, y, cat) {
  const st = `fill="none" stroke="${PET_EYE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  if (expr === 'happy' || expr === 'win')
    return `<path d="M91 ${y - 2}Q100 ${y + 12} 109 ${y - 2}Z" fill="#8A2F3E" stroke="${PET_EYE}" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="100" cy="${y + 5}" rx="4.6" ry="2.6" fill="#FF8C9E"/>`;
  if (expr === 'angry') return `<path d="M92 ${y + 1}Q100 ${y - 4} 108 ${y + 1}" ${st}/>`;
  if (expr === 'hurt') return `<path d="M90 ${y + 1}q5-5 10 0t10 0" ${st}/>`;
  if (cat) return `<path d="M91 ${y - 2}q4.5 5 9 0q4.5 5 9 0" ${st}/>`;
  return `<path d="M93 ${y - 2}Q100 ${y + 5} 107 ${y - 2}" ${st}/>`;
}

export function avatar(key = 'dog', options = {}) {
  key = CHARACTERS[key] ? key : (PET_LEGACY[key] || 'dog');
  // Pets added after the SVG set have no palette; their fallback borrows the dog's.
  const c = CHARACTERS[key] || CHARACTERS.dog, p = PET_PALETTE[key] || PET_PALETTE.dog, n = `pa${++petSeq}`;
  const { size = '', stage = 0, accessory = 'none', frame = 'basic', expression = 'normal' } = options;
  const form = Math.max(0, Math.min(3, Math.round(Number(stage)) || 0));
  const label = `${c.ko}, ${PET_FORMS[form]}`;
  const eggTag = form === 0 && size === 'home-featured' ? '<span class="avatar-stage-name">알</span>' : '';
  const img = petImage(key, form, expression);
  if (img) {
    // Sprites are fitted one by one, so growth is added back gently here (feet anchored).
    const grow = [.86, .86, .93, 1][form];
    return `<div class="avatar-art avatar-premium avatar-img faces-${img.facing} avatar-form-${form} frame-${frame} expr-${expression} ${size}" style="--avatar:${c.color};--avatar-soft:${c.soft}"><img src="${img.src}" alt="${label}" width="512" height="512" decoding="async" draggable="false" style="transform:scale(${grow});transform-origin:50% 96%">${eggTag}</div>`;
  }
  // SVG fallback draws five detail levels; map the three forms onto them.
  const s = [1, 2, 3, 5][form];
  const showEgg = form === 0;
  const L = `stroke="${p.line}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
  const wrap = inner => `<div class="avatar-art avatar-premium avatar-v2 avatar-form-${form} frame-${frame} expr-${expression} ${size}" style="--avatar:${c.color};--avatar-soft:${c.soft}"><svg viewBox="0 0 200 200" role="img" aria-label="${label}">${inner}</svg>${eggTag}</div>`;
  const defs = `<defs>
<radialGradient id="${n}h" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="${p.light}"/><stop offset=".55" stop-color="${p.base}"/><stop offset="1" stop-color="${p.shade}"/></radialGradient>
<radialGradient id="${n}b" cx=".42" cy=".22" r=".95"><stop offset="0" stop-color="${p.light}"/><stop offset=".5" stop-color="${p.base}"/><stop offset="1" stop-color="${p.shade}"/></radialGradient>
<radialGradient id="${n}aura" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${p.light}" stop-opacity=".8"/><stop offset=".6" stop-color="${p.light}" stop-opacity=".25"/><stop offset="1" stop-color="${p.light}" stop-opacity="0"/></radialGradient>
<linearGradient id="${n}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset="1" stop-color="#E9A93A"/></linearGradient>
<linearGradient id="${n}cape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.accent}"/><stop offset="1" stop-color="${petDarken(p.accent, -.28)}"/></linearGradient>
<clipPath id="${n}eggc"><path d="M100 30c-34 0-58 56-58 98 0 34 24 54 58 54s58-20 58-54c0-42-24-98-58-98Z"/></clipPath>
</defs>`;

  if (showEgg) {
    return wrap(defs + `<circle cx="100" cy="104" r="88" fill="url(#${n}aura)" opacity=".7"/><ellipse cx="100" cy="185" rx="44" ry="7" fill="#1d2939" opacity=".13"/>
<g class="pet-body"><path d="M100 30c-34 0-58 56-58 98 0 34 24 54 58 54s58-20 58-54c0-42-24-98-58-98Z" fill="#FFFDF8"/>
<g clip-path="url(#${n}eggc)"><path d="M36 122l16-11 16 11 16-11 16 11 16-11 16 11 16-11 16 11 16-11" fill="none" stroke="${p.base}" stroke-width="10" stroke-linejoin="round"/>
<circle cx="76" cy="80" r="10" fill="${p.base}" opacity=".85"/><circle cx="120" cy="60" r="6" fill="${p.base}" opacity=".7"/><circle cx="128" cy="156" r="11" fill="${p.base}" opacity=".75"/><circle cx="74" cy="158" r="6" fill="${p.base}" opacity=".6"/>
<ellipse cx="138" cy="120" rx="30" ry="60" fill="${p.shade}" opacity=".12"/></g>
<path d="M100 30c-34 0-58 56-58 98 0 34 24 54 58 54s58-20 58-54c0-42-24-98-58-98Z" fill="none" ${L}/>
<path d="M74 58q14-18 32-16" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".95"/></g>
${petStar(160, 58, 7, p.light)}${petStar(40, 92, 5, p.light, .8)}`);
  }

  const snake = key === 'snake', panda = key === 'panda', dragon = key === 'dragon';
  const k = [1, .8, .9, .97, 1][s - 1];
  const skin = `url(#${n}b)`, limb = panda ? p.ear : skin;
  const parts = [];

  // --- behind the body: aura, wings, cape, tail
  if (s >= 4) parts.push(`<circle cx="100" cy="112" r="92" fill="url(#${n}aura)" opacity="${s === 5 ? 1 : .55}"/>`);
  const inner = [];
  if (dragon && s >= 2) {
    const ws = s >= 4 ? 1.12 : .78;
    const wing = `<g transform="translate(72 132) scale(${ws}) translate(-72 -132)"><path d="M72 132q-30-36-54-32q9 12 3 21q13-4 15 9q12-6 15 7q10-8 21-5Z" fill="${s === 5 ? `url(#${n}gold)` : p.light}" ${L}/><path d="M68 128q-18-12-38-16M64 132q-12-4-24-4" fill="none" stroke="${p.line}" stroke-width="2" opacity=".5"/></g>`;
    inner.push(wing, petMirror(wing));
  } else if (s === 5) {
    const wing = `<path d="M76 130C62 98 40 78 12 72C18 82 18 90 14 96C27 96 31 102 27 110C39 108 43 115 39 124C51 122 55 130 53 139C62 137 69 140 74 146Z" fill="#FFFFFF" ${L}/><path d="M66 118C52 104 38 94 22 88M62 128C50 120 40 114 30 110M62 138C56 132 50 128 42 126" fill="none" stroke="${p.accent}" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>`;
    inner.push(wing, petMirror(wing));
  }
  if (s >= 4) inner.push(`<path d="M68 126q-18 30-22 56q54 12 108 0q-4-26-22-56Z" fill="url(#${n}cape)" ${L}/><path d="M78 140q-6 18-8 38M122 140q6 18 8 38" fill="none" stroke="#fff" stroke-width="2.4" opacity=".22"/>`);
  const tails = {
    dog: `<path d="M132 156q26-4 24-34q-2-9-9-4q2 18-18 26Z" fill="${skin}" ${L}/>`,
    cat: `<path d="M134 166q36 4 30-38q-1-10-9-8q-4 2-2 10q2 26-22 24Z" fill="${skin}" ${L}/><path d="M156 128q-2-8 5-8q6 2 3 10" fill="${p.shade}"/>`,
    pig: `<path d="M134 158q15-2 13-13q-2-8-9-4q-4 4 2 7" fill="none" stroke="${p.line}" stroke-width="8" stroke-linecap="round"/><path d="M134 158q15-2 13-13q-2-8-9-4q-4 4 2 7" fill="none" stroke="${p.base}" stroke-width="3.6" stroke-linecap="round"/>`,
    dragon: `<path d="M130 166q34 6 44-22l6-14-16 6q-8 18-34 14Z" fill="${skin}" ${L}/><path d="M174 144l6-14-16 6Z" fill="url(#${n}gold)" ${L}/>`,
    panda: `<circle cx="134" cy="170" r="8" fill="${p.ear}" ${L}/>`,
    snake: `<path d="M142 174q26 2 28-16q1-7-5-6q-2 11-23 10Z" fill="${skin}" ${L}/>`
  };
  inner.push(tails[key]);

  // --- body
  if (snake) {
    inner.push(`<ellipse cx="100" cy="171" rx="48" ry="15" fill="${skin}" ${L}/><ellipse cx="100" cy="153" rx="40" ry="14" fill="${skin}" ${L}/><ellipse cx="100" cy="137" rx="31" ry="12" fill="${skin}" ${L}/>
<ellipse cx="100" cy="176" rx="30" ry="6" fill="${p.belly}" opacity=".9"/><ellipse cx="100" cy="158" rx="24" ry="5" fill="${p.belly}" opacity=".9"/>
<g fill="${p.ear}"><ellipse cx="68" cy="168" rx="6" ry="3.5"/><ellipse cx="134" cy="167" rx="6" ry="3.5"/><ellipse cx="76" cy="149" rx="5" ry="3"/><ellipse cx="126" cy="149" rx="5" ry="3"/></g>`);
  } else {
    inner.push(`<ellipse cx="84" cy="177" rx="14" ry="8.5" fill="${limb}" ${L}/><ellipse cx="116" cy="177" rx="14" ry="8.5" fill="${limb}" ${L}/>
<ellipse cx="100" cy="150" rx="37" ry="31" fill="${skin}" ${L}/><ellipse cx="100" cy="156" rx="22" ry="18" fill="${p.belly}"/>`);
    if (dragon) inner.push(`<path d="M86 150h28M84 158h32M88 166h24" stroke="${p.shade}" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>`);
    inner.push(`<ellipse cx="66" cy="146" rx="9.5" ry="14" transform="rotate(28 66 146)" fill="${limb}" ${L}/><ellipse cx="134" cy="146" rx="9.5" ry="14" transform="rotate(-28 134 146)" fill="${limb}" ${L}/>`);
  }
  if (s >= 4) inner.push(`<path d="m100 ${snake ? 145 : 147} 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="url(#${n}gold)" stroke="#B7832F" stroke-width="1.4"/>`);
  if (s === 3) inner.push(`<path d="M64 132q36 16 72 0l2 10q-38 18-76 0Z" fill="${p.accent}" ${L}/><path d="M120 142l16 26-13 3-11-24Z" fill="${petDarken(p.accent, -.15)}" ${L}/>`);

  // --- ears / horns behind the head
  const backEars = {
    cat: `<path d="M58 74l4-46q2-7 9-2l31 27Z" fill="url(#${n}h)" ${L}/><path d="M67 64l2-27 18 16Z" fill="${p.ear}"/>`,
    pig: `<path d="M62 64l-7-32q0-7 7-4l29 19Z" fill="${p.base}" ${L}/><path d="M64 56l-4-19 17 11Z" fill="${p.ear}"/>`,
    panda: `<circle cx="60" cy="56" r="17" fill="${p.ear}" ${L}/>`,
    dragon: `<path d="M76 58q-9-22-3-36q9 11 17 31Z" fill="url(#${n}gold)" ${L}/>`
  };
  if (backEars[key]) inner.push(backEars[key], petMirror(backEars[key]));

  // --- head
  inner.push(`<ellipse cx="100" cy="92" rx="54" ry="48" fill="url(#${n}h)" ${L}/><ellipse cx="78" cy="62" rx="17" ry="8" transform="rotate(-22 78 62)" fill="#fff" opacity=".38"/>`);
  if (s === 2) inner.push(`<path d="M97 46q-3-15 9-17q-7 8 0 17Z" fill="url(#${n}h)" ${L}/>`);

  // --- markings and muzzle
  const face = {
    dog: `<ellipse cx="122" cy="90" rx="15" ry="14" fill="${p.shade}" opacity=".45"/><ellipse cx="100" cy="113" rx="19" ry="13" fill="${p.belly}"/><path d="M93 106q7-4 14 0q-2 6-7 7q-5-1-7-7Z" fill="#3A2A22"/><ellipse cx="98" cy="106.5" rx="2" ry="1.1" fill="#fff" opacity=".7"/>`,
    cat: `${s < 5 ? `<path d="M100 50v11M88 52l3 10M112 52l-3 10" stroke="${p.shade}" stroke-width="4" stroke-linecap="round"/>` : ''}<ellipse cx="100" cy="112" rx="18" ry="11" fill="${p.belly}"/><path d="M96 106h8l-4 5Z" fill="#E88A9B"/><path d="M62 108l-17-3M62 114l-17 2M138 108l17-3M138 114l17 2" stroke="${p.line}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`,
    pig: `<ellipse cx="100" cy="112" rx="15" ry="10.5" fill="${p.ear}" ${L}/><ellipse cx="94.5" cy="112" rx="2.6" ry="4" fill="${p.line}"/><ellipse cx="105.5" cy="112" rx="2.6" ry="4" fill="${p.line}"/>`,
    dragon: `<ellipse cx="100" cy="112" rx="18" ry="11" fill="${p.light}"/><circle cx="95" cy="109" r="2.1" fill="${p.line}"/><circle cx="105" cy="109" r="2.1" fill="${p.line}"/><path d="M48 90l-12-5 5 11-8 5 13 3Z" fill="${p.ear}" ${L}/>` ,
    panda: `<ellipse cx="80" cy="97" rx="14" ry="17" transform="rotate(22 80 97)" fill="${p.ear}"/><ellipse cx="120" cy="97" rx="14" ry="17" transform="rotate(-22 120 97)" fill="${p.ear}"/><ellipse cx="100" cy="109" rx="6.2" ry="4.4" fill="${p.ear}"/>`,
    snake: `<ellipse cx="100" cy="56" rx="11" ry="6" fill="${p.ear}"/><circle cx="80" cy="62" r="4.2" fill="${p.ear}"/><circle cx="120" cy="62" r="4.2" fill="${p.ear}"/>`
  };
  inner.push(face[key]);
  if (dragon) inner.push(petMirror(`<path d="M48 90l-12-5 5 11-8 5 13 3Z" fill="${p.ear}" ${L}/>`));
  inner.push(petEyes(expression, panda));
  inner.push(`<ellipse cx="65" cy="113" rx="9" ry="5.5" fill="#FF8FA3" opacity="${panda ? .6 : .5}"/><ellipse cx="135" cy="113" rx="9" ry="5.5" fill="#FF8FA3" opacity="${panda ? .6 : .5}"/>`);
  const mouthY = { dog: 121, cat: 117, pig: 128, dragon: 122, panda: 116, snake: 114 }[key];
  inner.push(petMouth(expression, mouthY, key === 'cat'));
  if (snake && (expression === 'angry' || expression === 'win'))
    inner.push(`<path d="M100 ${mouthY + 4}v9l-4 5M100 ${mouthY + 13}l4 5" stroke="#E5484D" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);

  // --- ears in front of the head
  if (key === 'dog') {
    const ear = `<path d="M62 58q-24 4-21 42q2 19 15 16q10-2 12-25q2-20-6-33Z" fill="${p.ear}" ${L}/>`;
    inner.push(ear, petMirror(ear));
  }
  if (s >= 4) inner.push(`<circle cx="68" cy="134" r="5" fill="url(#${n}gold)" stroke="#B7832F" stroke-width="1.6"/><circle cx="132" cy="134" r="5" fill="url(#${n}gold)" stroke="#B7832F" stroke-width="1.6"/>`);
  if (s === 5) inner.push(`<path d="M100 48l7 8-7 9-7-9Z" fill="url(#${n}gold)" stroke="#B7832F" stroke-width="2"/>`);

  // --- accessories (same keys as ACCESSORIES in core.js)
  const acc = {
    headset: `<path d="M48 94Q48 38 100 38T152 94" fill="none" stroke="#414758" stroke-width="7"/><rect x="41" y="84" width="13" height="26" rx="6" fill="#515969"/><rect x="146" y="84" width="13" height="26" rx="6" fill="#515969"/>`,
    glasses: `<g fill="none" stroke="#3c4353" stroke-width="3.4"><rect x="66" y="84" width="28" height="24" rx="9"/><rect x="106" y="84" width="28" height="24" rx="9"/><path d="M94 94h12"/></g>`,
    starpin: petStar(138, 58, 9, '#FFE27A') + `<circle cx="138" cy="58" r="2.4" fill="#fff"/>`,
    visor: `<path d="M60 82h80l-7 24H67Z" fill="#708d99" fill-opacity=".55" stroke="#e9f3f6" stroke-width="2.4" stroke-linejoin="round"/>`,
    crown: `<path d="M78 52l-4-27 15 12 11-19 11 19 15-12-4 27Z" fill="url(#${n}gold)" stroke="#B7832F" stroke-width="2.4" stroke-linejoin="round"/><circle cx="100" cy="40" r="3" fill="#fff"/>`
  }[accessory] || '';
  inner.push(acc);

  parts.push(`<ellipse cx="100" cy="186" rx="${Math.round(44 * k)}" ry="7" fill="#1d2939" opacity=".14"/>`);
  parts.push(`<g transform="translate(100 186) scale(${k}) translate(-100 -186)"><g class="pet-body">${inner.join('')}</g></g>`);
  if (s >= 4) parts.push(petStar(170, 44, 8, s === 5 ? '#FFD85A' : p.light), petStar(30, 70, 6, p.light, .85));
  if (s === 5) parts.push(petStar(176, 118, 5, '#FFD85A', .9), petStar(26, 140, 4.5, '#FFD85A', .8));
  if (expression === 'win') parts.push(petStar(150, 30, 7, '#FFD85A'), petStar(50, 34, 5, '#FFD85A'));
  return wrap(defs + parts.join(''));
}
