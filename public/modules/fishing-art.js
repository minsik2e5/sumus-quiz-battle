import { FISH } from './fishing-rules.js';
import { FISH_READY } from './fish-art.js';

// V13.149 물고기 그림(코드 그림). 그림 주문서 26(docs/asset-requests/runner/26-fishing.txt)의 그림이 들어오면
// /assets/fish/<key>.webp(256px 정사각형)를 먼저 쓰고(FISH_ART), 없으면 아래 SVG를 그린다.
// 모든 물고기는 오른쪽을 본다. viewBox 0 0 120 72.
// V13.149 그림 26: 24종 모두 그림이 들어왔다. V13.185 그림 폴더를 보고 build:assets가 만드는 목록(fish-art.js)을 쓴다.
export const FISH_ART = new Set([...FISH_READY].filter(k => FISH[k]));

let uid = 0;
const BODY = {
  slim: { rx: 44, ry: 12, tail: 15 }, torpedo: { rx: 46, ry: 16, tail: 18 }, round: { rx: 36, ry: 23, tail: 17 },
  ball: { rx: 27, ry: 25, tail: 14 }, flat: { rx: 40, ry: 24, tail: 14 }, long: { rx: 50, ry: 14, tail: 15 },
  needle: { rx: 48, ry: 7, tail: 11 }, sword: { rx: 40, ry: 15, tail: 18 }, shark: { rx: 46, ry: 15, tail: 20 },
  moon: { rx: 28, ry: 26, tail: 6 }, ray: { rx: 30, ry: 28, tail: 0 }, squid: { rx: 30, ry: 13, tail: 0 }
};

function bodyPath(cx, cy, rx, ry, kind) {
  const nose = cx + rx, back = cx - rx;
  const top = kind === 'flat' ? ry * 1.05 : ry, bot = kind === 'flat' ? ry * .75 : ry;
  const blunt = kind === 'ball' || kind === 'moon' ? .9 : kind === 'round' ? .7 : .45;
  return `M${nose},${cy} C${nose},${cy - top * blunt} ${cx + rx * .4},${cy - top} ${cx},${cy - top} C${cx - rx * .55},${cy - top} ${back + 4},${cy - top * .45} ${back},${cy} C${back + 4},${cy + bot * .45} ${cx - rx * .55},${cy + bot} ${cx},${cy + bot} C${cx + rx * .4},${cy + bot} ${nose},${cy + bot * blunt} ${nose},${cy}Z`;
}
function pattern(mark, cx, cy, rx, ry, a) {
  const c = a.fin;
  switch (mark) {
    case 'line': return `<path d="M${cx - rx + 8},${cy} Q${cx},${cy - 3} ${cx + rx - 10},${cy - 1}" stroke="${c}" stroke-width="2.4" fill="none" opacity=".75"/>`;
    case 'bars': return [-.45, -.15, .15, .45].map(k => `<rect x="${cx + rx * k - 3}" y="${cy - ry}" width="6" height="${ry * 2}" fill="${c}" opacity=".45" rx="3"/>`).join('');
    case 'dots': return Array.from({ length: 9 }, (_, i) => `<circle cx="${cx - rx * .6 + (i % 5) * rx * .3}" cy="${cy - ry * .45 + Math.floor(i / 5) * ry * .5 + (i % 2) * 3}" r="${1.6 + (i % 3) * .5}" fill="${c}" opacity=".55"/>`).join('');
    case 'scales': return Array.from({ length: 10 }, (_, i) => `<path d="M${cx - rx * .55 + (i % 5) * rx * .26},${cy - ry * .35 + Math.floor(i / 5) * ry * .55} q4,4 0,8" stroke="${c}" stroke-width="1.4" fill="none" opacity=".5"/>`).join('');
    case 'waves': return [0, 1, 2].map(i => `<path d="M${cx - rx * .7},${cy - ry * .6 + i * 5} q6,-4 12,0 t12,0 t12,0 t12,0 t12,0" stroke="${c}" stroke-width="1.8" fill="none" opacity=".7"/>`).join('');
    case 'stars': return Array.from({ length: 12 }, (_, i) => `<circle cx="${cx - rx * .7 + (i % 6) * rx * .27}" cy="${cy - ry * .55 + Math.floor(i / 6) * ry * .55 + (i % 2) * 4}" r="1.7" fill="#fff" opacity=".85"/>`).join('');
    case 'finlets': return Array.from({ length: 5 }, (_, i) => `<path d="M${cx - rx * .3 - i * 7},${cy - ry * .9} l-3,-4 l-2,4z M${cx - rx * .3 - i * 7},${cy + ry * .9} l-3,4 l-2,-4z" fill="${c}"/>`).join('');
    case 'egg': return `<ellipse cx="${cx - 2}" cy="${cy + 2}" rx="9" ry="11" fill="#fffbe6" stroke="${a.fin}" stroke-width="1.6"/><path d="M${cx - 8},${cy + 2} l4,-3 4,3 4,-3 3,3" stroke="#f59e0b" stroke-width="1.4" fill="none"/>`;
    default: return '';
  }
}

export function fishSvg(key, { cls = '' } = {}) {
  const f = FISH[key];
  if (!f) return '';
  const a = f.art, kind = a.body, B = BODY[kind] || BODY.round, id = `fa${++uid}`;
  const cx = 62, cy = 36, { rx, ry, tail } = B;
  const defs = `<defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.c1}"/><stop offset=".62" stop-color="${a.c1}"/><stop offset="1" stop-color="${a.c2}"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}c"><path d="${bodyPath(cx, cy, rx, ry, kind)}"/></clipPath></defs>`;
  let back = '', front = '', body = '';
  const eyeX = cx + rx * .62, eyeY = cy - ry * (kind === 'flat' ? .5 : .22), eyeR = Math.max(2.6, Math.min(5, ry * .22));
  if (kind === 'ray') {
    body = `<path d="M${cx + 30},${cy} C${cx + 18},${cy - 10} ${cx},${cy - 32} ${cx - 8},${cy - 30} C${cx - 18},${cy - 20} ${cx - 22},${cy - 6} ${cx - 26},${cy} C${cx - 22},${cy + 6} ${cx - 18},${cy + 20} ${cx - 8},${cy + 30} C${cx},${cy + 32} ${cx + 18},${cy + 10} ${cx + 30},${cy}Z" fill="url(#${id}b)" stroke="${a.fin}" stroke-width="1.5"/>
      <path d="M${cx - 26},${cy} C${cx - 40},${cy + 2} ${cx - 52},${cy - 2} ${cx - 60},${cy + 4}" stroke="${a.fin}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    return wrap(key, cls, `${defs}${body}<g clip-path="url(#${id}c)"></g>${pattern(a.mark, cx, cy, 22, 18, a)}<circle cx="${cx + 14}" cy="${cy - 6}" r="2.6" fill="#1f2937"/><circle cx="${cx + 14}" cy="${cy + 6}" r="2.6" fill="#1f2937"/>`);
  }
  if (kind === 'squid') {
    const tent = Array.from({ length: 6 }, (_, i) => `<path d="M${cx - 26},${cy - 6 + i * 2.4} C${cx - 40},${cy - 12 + i * 5} ${cx - 48},${cy - 4 + i * 2} ${cx - 56},${cy - 10 + i * 4.5}" stroke="${a.c1}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`).join('');
    body = `${tent}<path d="M${cx + 36},${cy} C${cx + 30},${cy - 14} ${cx - 4},${cy - 14} ${cx - 28},${cy - 8} L${cx - 28},${cy + 8} C${cx - 4},${cy + 14} ${cx + 30},${cy + 14} ${cx + 36},${cy}Z" fill="url(#${id}b)" stroke="${a.fin}" stroke-width="1.5"/>
      <path d="M${cx + 36},${cy} l10,-10 l-2,10 l2,10z" fill="${a.fin}"/>`;
    return wrap(key, cls, `${defs}${body}${pattern(a.mark, cx + 4, cy, 24, 9, a)}<circle cx="${cx - 18}" cy="${cy - 2}" r="4" fill="#fff"/><circle cx="${cx - 17}" cy="${cy - 2}" r="2.4" fill="#111827"/>`);
  }
  // 꼬리
  const tx = cx - rx + 3;
  const tailPath = kind === 'shark' || kind === 'sword'
    ? `M${tx},${cy} L${tx - tail},${cy - tail * 1.1} Q${tx - tail * .55},${cy} ${tx - tail * .8},${cy + tail * .8}Z`
    : kind === 'moon' ? `M${tx + 2},${cy - ry * .8} Q${tx - 8},${cy} ${tx + 2},${cy + ry * .8} L${tx - 4},${cy}Z`
      : kind === 'long' && a.lobed ? `M${tx},${cy} Q${tx - tail},${cy - tail * .9} ${tx - tail * 1.2},${cy} Q${tx - tail},${cy + tail * .9} ${tx},${cy}Z`
        : `M${tx},${cy} L${tx - tail},${cy - tail * .85} Q${tx - tail * .6},${cy} ${tx - tail},${cy + tail * .85}Z`;
  back += `<path d="${tailPath}" fill="${a.fin}" stroke="${a.fin}" stroke-width="1" stroke-linejoin="round"/>`;
  // 등지느러미 · 배지느러미
  if (kind === 'shark') back += `<path d="M${cx - 4},${cy - ry + 1} L${cx - 14},${cy - ry - 16} L${cx + 10},${cy - ry + 1}Z" fill="${a.fin}"/>`;
  else if (kind === 'moon') back += `<path d="M${cx - 10},${cy - ry + 2} L${cx - 16},${cy - ry - 22} L${cx + 4},${cy - ry + 2}Z M${cx - 10},${cy + ry - 2} L${cx - 16},${cy + ry + 22} L${cx + 4},${cy + ry - 2}Z" fill="${a.fin}"/>`;
  else if (a.spiky) back += Array.from({ length: 6 }, (_, i) => `<path d="M${cx - rx * .5 + i * rx * .2},${cy - ry + 2} l${-2},-${10 + (i % 2) * 4} l6,${10}" fill="${a.fin}" stroke="${a.fin}" stroke-width="1"/>`).join('');
  else back += `<path d="M${cx - rx * .45},${cy - ry + 2} Q${cx - rx * .1},${cy - ry - 10} ${cx + rx * .25},${cy - ry + 3}Z" fill="${a.fin}"/>`;
  if (kind !== 'needle') back += `<path d="M${cx - rx * .25},${cy + ry - 2} Q${cx - rx * .1},${cy + ry + 7} ${cx + rx * .1},${cy + ry - 1}Z" fill="${a.fin}" opacity=".9"/>`;
  if (kind === 'sword') back += `<path d="M${cx + rx - 2},${cy - 3} L${cx + rx + 34},${cy - 1} L${cx + rx - 2},${cy + 2}Z" fill="${a.c1}" stroke="${a.fin}" stroke-width=".8"/>`;
  if (kind === 'needle') back += `<path d="M${cx + rx - 2},${cy - 2} L${cx + rx + 10},${cy} L${cx + rx - 2},${cy + 1}Z" fill="${a.fin}"/>`;
  body = `<path d="${bodyPath(cx, cy, rx, ry, kind)}" fill="url(#${id}b)" stroke="${a.fin}" stroke-width="1.4"/>
    <g clip-path="url(#${id}c)">${pattern(a.mark, cx, cy, rx, ry, a)}<ellipse cx="${cx + 4}" cy="${cy - ry * .55}" rx="${rx * .8}" ry="${ry * .35}" fill="url(#${id}s)"/>
    <path d="M${cx + rx * .38},${cy - ry} Q${cx + rx * .22},${cy} ${cx + rx * .38},${cy + ry}" stroke="${a.fin}" stroke-width="1.3" fill="none" opacity=".55"/></g>`;
  // 가슴지느러미
  front += `<path d="M${cx + rx * .28},${cy + 2} q-10,2 -14,10 q10,-1 14,-6z" fill="${a.fin}" opacity=".85"/>`;
  if (a.whisker) front += `<path d="M${cx + rx - 4},${cy + 3} q8,4 10,12 M${cx + rx - 6},${cy + 4} q4,6 2,13" stroke="${a.fin}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  front += `<circle cx="${eyeX}" cy="${eyeY}" r="${eyeR + 1.4}" fill="#fff"/><circle cx="${eyeX + .6}" cy="${eyeY}" r="${eyeR}" fill="#111827"/><circle cx="${eyeX + 1.6}" cy="${eyeY - 1.2}" r="${eyeR * .38}" fill="#fff"/>`;
  front += `<path d="M${cx + rx - 1},${cy + ry * .18} q-4,2 -7,1" stroke="#1f2937" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".6"/>`;
  if (a.shine) front += [[cx - 18, cy - ry - 6, 5], [cx + 22, cy + ry + 3, 4], [cx - rx - 4, cy - 10, 3.5]].map(([x, y, r]) => `<path d="M${x},${y - r} L${x + r * .3},${y - r * .3} L${x + r},${y} L${x + r * .3},${y + r * .3} L${x},${y + r} L${x - r * .3},${y + r * .3} L${x - r},${y} L${x - r * .3},${y - r * .3}Z" fill="#fff7c2" class="fa-twinkle"/>`).join('');
  return wrap(key, cls, `${defs}${back}${body}${front}`);
}
const wrap = (key, cls, inner) => `<svg class="fish-svg ${FISH[key].rarity} ${cls}" viewBox="0 0 120 72" role="img" aria-label="${FISH[key].name}">${inner}</svg>`;

// 그림이 있으면 그림, 없으면 SVG.
export const fishPic = (key, opts = {}) => FISH_ART.has(key)
  ? `<img class="fish-img ${opts.cls || ''}" src="/assets/fish/${key}.webp" alt="${FISH[key]?.name || ''}" width="256" height="256" decoding="async" draggable="false">`
  : fishSvg(key, opts);
// 모르는 물고기(도감의 실루엣).
export const fishShadow = key => `<span class="fish-shadow">${fishSvg(key)}</span>`;
