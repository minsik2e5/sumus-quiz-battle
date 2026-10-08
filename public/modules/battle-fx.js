// V13.115 전투 효과 2탄: 펫 속성별 공격 · 스킬 컷인 · 막기 · 회복 · 파워업 · 독 · 콤보 등급 · 속도선.
// Presentation only (the rules are in battle-engine.js). Everything is drawn over the arena element
// with the Web Animations API and removes itself; the caller (battle.js) never calls these when the
// player asked for less motion. At most FX2_MAX pieces live at once, so a slow phone is never swamped.

/* ---------- 속성 ---------- */
export const ELEMENTS = {
  flame: { name: '불꽃', c1: '#ff7a1a', c2: '#ffd23f', c3: '#e5172f' },
  ice: { name: '얼음', c1: '#8fdcff', c2: '#effaff', c3: '#3da5e0' },
  water: { name: '물', c1: '#4fb6ff', c2: '#d4f1ff', c3: '#1f7fd1' },
  leaf: { name: '풀', c1: '#6bd36a', c2: '#d4f5a0', c3: '#2f9e4a' },
  earth: { name: '바위', c1: '#c68f58', c2: '#f3dbb0', c3: '#7a5330' },
  wind: { name: '바람', c1: '#8fe0c8', c2: '#f0fffa', c3: '#3fb594' },
  toxic: { name: '독', c1: '#b266e8', c2: '#ecd0ff', c3: '#6b2fa8' },
  star: { name: '별빛', c1: '#ffd23f', c2: '#fff6c8', c3: '#f29a1f' }
};
// Which element a pet attacks with (by its look). A pet not listed attacks with star light.
export const PET_ELEMENT = {
  dragon: 'flame', phoenix: 'flame', fox: 'flame', redpanda: 'flame', jujak: 'flame', pumpkincat: 'flame',
  penguin: 'ice', arcticfox: 'ice', sheep: 'ice', baekho: 'ice',
  shark: 'water', otter: 'water', duck: 'water', whale: 'water', seal: 'water', octopus: 'water', frog: 'water', turtle: 'water', cheongryong: 'water', capybara: 'water',
  panda: 'leaf', koala: 'leaf', deer: 'leaf', squirrel: 'leaf', rabbit: 'leaf', alpaca: 'leaf',
  bear: 'earth', hedgehog: 'earth', hamster: 'earth', pig: 'earth', hyeonmu: 'earth',
  wolf: 'wind', owl: 'wind', parrot: 'wind', cat: 'wind', sapsaree: 'wind', cheonma: 'wind', dog: 'wind',
  snake: 'toxic', crocodile: 'toxic', ghost: 'toxic', gumiho: 'toxic'
};
export const elementOf = key => PET_ELEMENT[key] || 'star';
export const paletteOf = key => ELEMENTS[elementOf(key)];

/* ---------- 도형 (SVG, 24×24) ---------- */
const SHAPES = {
  flame: (a, b) => `<path d="M12 1c1.2 4.6 6.4 6.2 6.4 12.4a6.4 6.4 0 0 1-12.8 0c0-3.2 2.1-4.6 3.2-7.4 1.1 1 1.9 2.2 2 4 1.3-2.7 1.5-5.6 1.2-9z" fill="${a}"/><path d="M12 11c.7 2 3 2.9 3 5.6a3 3 0 0 1-6 0c0-1.6 1.3-2.4 3-5.6z" fill="${b}"/>`,
  ice: (a, b) => `<path d="M12 1l5.2 11L12 23 6.8 12z" fill="${a}" stroke="${b}" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 4l2.2 8L12 20" fill="none" stroke="${b}" stroke-width="1.1" opacity=".8"/>`,
  water: (a, b) => `<path d="M12 1.5c4.2 6 7.2 9.3 7.2 13.3a7.2 7.2 0 0 1-14.4 0c0-4 3-7.3 7.2-13.3z" fill="${a}"/><ellipse cx="9" cy="14.5" rx="1.8" ry="3" fill="${b}" opacity=".85" transform="rotate(18 9 14.5)"/>`,
  leaf: (a, b) => `<path d="M3 21C3 10 10 3 21.5 3 21.5 14 15 21 3 21z" fill="${a}"/><path d="M5.5 18.5C10 13 14 9 18.5 6" fill="none" stroke="${b}" stroke-width="1.6" stroke-linecap="round"/>`,
  earth: (a, b) => `<path d="M3.5 16.5l3.2-9.4 8-3.4 6 7.6-3 9.2-9.8 1z" fill="${a}"/><path d="M6.7 7.1l5.3 4.2 8.7.4M12 11.3l-1 8.4" fill="none" stroke="${b}" stroke-width="1.2" opacity=".75"/>`,
  wind: (a, b) => `<path d="M2 21C8 7 16.5 3 22.5 4 15.5 8.5 11 14.5 2 21z" fill="${a}"/><path d="M5 17.5C10 10 15 6.5 20 5.2" fill="none" stroke="${b}" stroke-width="1.4" stroke-linecap="round"/>`,
  toxic: (a, b) => `<circle cx="12" cy="12" r="9.5" fill="${a}"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="${b}" stroke-width="1.6"/><ellipse cx="8.6" cy="8.4" rx="2.6" ry="1.6" fill="${b}" opacity=".9" transform="rotate(-35 8.6 8.4)"/>`,
  star: (a, b) => `<path d="M12 1l2.9 8.1L23 12l-8.1 2.9L12 23l-2.9-8.1L1 12l8.1-2.9z" fill="${a}" stroke="${b}" stroke-width="1.2" stroke-linejoin="round"/>`
};
const svg = (kind, el, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${SHAPES[kind](ELEMENTS[el].c1, ELEMENTS[el].c2)}</svg>`;

/* ---------- 바탕 도구 ---------- */
export const FX2_MAX = 44;
const live = arena => arena.querySelectorAll('[data-fx]').length;
function piece(arena, className, css, ms, html = '') {
  if (!arena || live(arena) >= FX2_MAX) return null;
  const el = document.createElement('div');
  el.dataset.fx = '';
  el.className = `fx2 ${className}`;
  // (A custom property such as --c1 only takes with setProperty; Object.assign would drop it.)
  for (const [key, value] of Object.entries(css)) key.startsWith('--') ? el.style.setProperty(key, value) : (el.style[key] = value);
  if (html) el.innerHTML = html;
  arena.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}
const run = (el, frames, opts) => { if (!el) return null; try { return el.animate(frames, { fill: 'forwards', ...opts }); } catch { return null; } };
const rand = (a, b) => a + Math.random() * (b - a);
const tr = (x, y, extra = '') => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) ${extra}`;

/* ---------- 날아가는 공격 ---------- */
// A shot of the pet's element flies from `from` to `to` (arena pixels). `big`: a bigger one.
export function fxShot(arena, from, to, el, { big = false, ms = 230 } = {}) {
  const dx = to.x - from.x, dy = to.y - from.y, ang = Math.atan2(dy, dx), size = big ? 46 : 32;
  const kind = el === 'wind' ? 'wind' : el;
  const shot = piece(arena, `fx2-shot ${el}`, { left: from.x + 'px', top: from.y + 'px', '--c1': ELEMENTS[el].c1 }, ms + 260, svg(kind, el, size));
  if (!shot) return;
  const spin = el === 'wind' ? 0 : el === 'ice' || el === 'earth' || el === 'leaf' ? 540 : el === 'star' ? 360 : 0;
  const baseRot = el === 'wind' || el === 'flame' ? `rotate(${ang * 180 / Math.PI + (el === 'flame' ? 90 : 20)}deg)` : '';
  run(shot, [
    { transform: tr(0, 0, `${baseRot} scale(.5)`), opacity: .3 },
    { transform: tr(dx, dy, `${baseRot} rotate(${spin}deg) scale(${big ? 1.35 : 1})`), opacity: 1 }
  ], { duration: ms, easing: 'cubic-bezier(.3,.05,.7,1)' });
  // A trail of copies behind the shot (3 small afterimages).
  for (let i = 1; i <= 3; i++) {
    const ghost = piece(arena, `fx2-ghost ${el}`, { left: from.x + 'px', top: from.y + 'px', opacity: 0 }, ms + 200, svg(kind, el, Math.round(size * (1 - i * .16))));
    run(ghost, [
      { transform: tr(0, 0, `${baseRot} scale(.45)`), opacity: 0 },
      { transform: tr(dx * (1 - i * .09), dy * (1 - i * .09), `${baseRot} rotate(${spin * (1 - i * .09)}deg)`), opacity: .5 - i * .12 },
      { transform: tr(dx * (1 - i * .09), dy * (1 - i * .09), `${baseRot} rotate(${spin * (1 - i * .09)}deg) scale(.5)`), opacity: 0 }
    ], { duration: ms + 120, easing: 'ease-out', delay: i * 18 });
  }
}

/* ---------- 맞는 순간 ---------- */
// The hit: a burst that depends on the element. tier 1 small, 2 medium, 3 big (skill, fever, K.O.).
export function fxImpact(arena, at, el, tier = 1) {
  const n = tier >= 3 ? 12 : tier === 2 ? 9 : 6, P = ELEMENTS[el], put = (kind, x, y, size, ms, frames, delay = 0) => run(piece(arena, `fx2-bit ${el}`, { left: at.x + 'px', top: at.y + 'px' }, ms + delay + 80, svg(kind, el, size)), frames, { duration: ms, delay, easing: 'cubic-bezier(.1,.8,.3,1)' });
  const ring = (size, ms, c = P.c1, squash = 1, delay = 0) => run(piece(arena, 'fx2-ring', { left: at.x + 'px', top: at.y + 'px', width: size + 'px', height: size * squash + 'px', borderColor: c, boxShadow: `0 0 14px ${c}` }, ms + delay + 80), [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: ms, delay, easing: 'cubic-bezier(.1,.9,.3,1)' });
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * i / n + rand(-.25, .25), d = rand(46, 66) + tier * 14, s = rand(13, 20) + tier * 3, x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (el === 'flame') put('flame', 0, 0, s + 4, 520, [{ transform: tr(0, 0, 'scale(.4)'), opacity: 1 }, { transform: tr(x * .8, y * .8 - 26, `scale(1.1)`), opacity: .9, offset: .5 }, { transform: tr(x, y - 58, 'scale(.2)'), opacity: 0 }]);
    else if (el === 'ice') put('ice', 0, 0, s + 2, 480, [{ transform: tr(0, 0, 'rotate(0deg) scale(.3)'), opacity: 1 }, { transform: tr(x * 1.15, y * 1.15, `rotate(${rand(-220, 220)}deg) scale(1)`), opacity: 1, offset: .6 }, { transform: tr(x * 1.3, y * 1.3 + 12, `rotate(${rand(-300, 300)}deg) scale(.6)`), opacity: 0 }]);
    else if (el === 'water') put('water', 0, 0, s, 640, [{ transform: tr(0, 0, 'scale(.4)'), opacity: 1 }, { transform: tr(x * .7, -Math.abs(y) - 36, 'scale(1)'), opacity: 1, offset: .45 }, { transform: tr(x * 1.1, 34 + Math.abs(y) * .2, 'scale(.7)'), opacity: 0 }]);
    else if (el === 'leaf') put('leaf', 0, 0, s + 2, 700, [{ transform: tr(0, 0, 'rotate(0deg) scale(.4)'), opacity: 1 }, { transform: tr(Math.cos(a + .9) * d * .8, Math.sin(a + .9) * d * .8, `rotate(${rand(200, 300)}deg) scale(1)`), opacity: 1, offset: .55 }, { transform: tr(Math.cos(a + 1.6) * d * 1.1, Math.sin(a + 1.6) * d * 1.1 + 18, `rotate(${rand(400, 560)}deg) scale(.5)`), opacity: 0 }]);
    else if (el === 'earth') put('earth', 0, 0, s + 3, 620, [{ transform: tr(0, 0, 'scale(.4)'), opacity: 1 }, { transform: tr(x * .7, -Math.abs(y) - 40, `rotate(${rand(-180, 180)}deg)`), opacity: 1, offset: .4 }, { transform: tr(x, 30 + Math.abs(y) * .3, `rotate(${rand(-360, 360)}deg) scale(.8)`), opacity: 0 }]);
    else if (el === 'wind') put('wind', 0, 0, s + 6, 460, [{ transform: tr(0, 0, `rotate(${a * 180 / Math.PI}deg) scale(.3)`), opacity: 1 }, { transform: tr(x * 1.2, y * 1.2, `rotate(${a * 180 / Math.PI + 120}deg) scale(1)`), opacity: 1, offset: .55 }, { transform: tr(x * 1.5, y * 1.5, `rotate(${a * 180 / Math.PI + 220}deg) scale(.5)`), opacity: 0 }]);
    else if (el === 'toxic') put('toxic', 0, 0, s + 2, 700, [{ transform: tr(0, 0, 'scale(.3)'), opacity: 1 }, { transform: tr(x * .8, y * .5 - 30, 'scale(1)'), opacity: .95, offset: .5 }, { transform: tr(x, y * .3 - 70, 'scale(1.3)'), opacity: 0 }]);
    else put('star', 0, 0, s, 520, [{ transform: tr(0, 0, 'rotate(0deg) scale(.3)'), opacity: 1 }, { transform: tr(x, y, `rotate(${rand(-180, 180)}deg) scale(1)`), opacity: 1, offset: .6 }, { transform: tr(x * 1.25, y * 1.25, 'scale(.3)'), opacity: 0 }]);
  }
  // The element's signature mark at the hit.
  if (el === 'ice') { ring(120 + tier * 40, 480, '#ffffff'); put('ice', 0, 0, 54 + tier * 14, 520, [{ transform: tr(0, 0, 'rotate(0deg) scale(.1)'), opacity: 1 }, { transform: tr(0, 0, 'rotate(60deg) scale(1)'), opacity: .95, offset: .4 }, { transform: tr(0, 0, 'rotate(90deg) scale(1.15)'), opacity: 0 }]); }
  else if (el === 'water') { ring(130 + tier * 36, 560, P.c2, .42); ring(90 + tier * 28, 560, P.c1, .42, 90); }
  else if (el === 'earth') { ring(140 + tier * 44, 520, P.c2, .5); ring(100 + tier * 30, 520, P.c1, .5, 70); }
  else if (el === 'flame') { ring(110 + tier * 40, 460, P.c2); }
  else if (el === 'toxic') { ring(110 + tier * 36, 560, P.c2, .6); }
  else if (el === 'leaf') { ring(110 + tier * 36, 520, P.c2); }
  else if (el === 'wind') {
    for (const rot of [-32, 28]) run(piece(arena, 'fx2-slash', { left: at.x + 'px', top: at.y + 'px', '--c': P.c2, '--cg': P.c1, width: 150 + tier * 40 + 'px' }, 460), [{ transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(.1)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(1)`, opacity: 1, offset: .35 }, { transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(1.05)`, opacity: 0 }], { duration: 440, easing: 'cubic-bezier(.1,.9,.3,1)' });
  } else { ring(120 + tier * 40, 480, P.c2); }
}

/* ---------- 속도선 · 화면 쿵 ---------- */
// Radial speed lines around the one hit (a fast, fever or skill hit).
export function fxSpeedLines(arena, at, el) {
  const P = ELEMENTS[el];
  run(piece(arena, 'fx2-lines', { left: at.x + 'px', top: at.y + 'px', '--c': P.c2 }, 520), [{ transform: 'translate(-50%,-50%) scale(.5) rotate(0deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(6deg)', opacity: .95, offset: .25 }, { transform: 'translate(-50%,-50%) scale(1.3) rotate(10deg)', opacity: 0 }], { duration: 480, easing: 'ease-out' });
}
// A small zoom punch of the whole arena (the `scale` property, so it adds to the shake).
export function fxPunch(arena, amount = .045) {
  try { arena.animate([{ scale: 1 }, { scale: 1 + amount, offset: .22 }, { scale: 1 }], { duration: 260, easing: 'ease-out' }); } catch {}
}

/* ---------- 스킬 컷인 ---------- */
// A pet skill goes off: a diagonal band in the element's colors sweeps in with the pet's picture
// and the skill's name, holds a blink, and sweeps out (~0.95 s). It never blocks taps.
export function fxSkillCutIn(arena, { side, portrait = '', name = '', desc = '', petName = '', el = 'star' }) {
  const P = ELEMENTS[el];
  const box = piece(arena, `fx2-cut ${side}`, { '--c1': P.c1, '--c2': P.c2, '--c3': P.c3 }, 1100, `<div class="fx2-cut-dim"></div><div class="fx2-cut-band"><div class="fx2-cut-lines"></div><div class="fx2-cut-pet">${portrait}</div><div class="fx2-cut-text"><small>${petName}</small><b>${name}</b><em>${desc}</em></div></div>`);
  if (!box) return;
  box.setAttribute('aria-hidden', 'true');
  const from = side === 'me' ? '-110%' : '110%';
  const band = box.querySelector('.fx2-cut-band'), dim = box.querySelector('.fx2-cut-dim');
  // (Easing is set per step: the way in is fast, the hold is still, the way out accelerates.)
  run(band, [
    { transform: `translateX(${from}) skewY(-5deg)`, opacity: 0, easing: 'cubic-bezier(.15,.85,.25,1)' },
    { transform: 'translateX(0) skewY(-5deg)', opacity: 1, offset: .2 },
    { transform: 'translateX(0) skewY(-5deg) scale(1.03)', opacity: 1, offset: .78, easing: 'cubic-bezier(.6,0,.9,.35)' },
    { transform: `translateX(${side === 'me' ? '110%' : '-110%'}) skewY(-5deg)`, opacity: 0 }
  ], { duration: 950, easing: 'linear' });
  run(dim, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .78 }, { opacity: 0 }], { duration: 950 });
  const pet = box.querySelector('.fx2-cut-pet');
  run(pet, [{ transform: 'translateX(-30px) scale(.8)' }, { transform: 'translateX(0) scale(1.08)', offset: .25 }, { transform: 'translateX(8px) scale(1.12)' }], { duration: 950, easing: 'ease-out' });
}

/* ---------- 막기 · 회복 · 파워업 · 독 ---------- */
export function fxShield(arena, at, color = '#7fd0ff', broke = false) {
  const el = piece(arena, 'fx2-shield', { left: at.x + 'px', top: at.y + 'px', '--c': color }, 760);
  run(el, [{ transform: 'translate(-50%,-52%) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-52%) scale(1.05)', opacity: .95, offset: .22 }, { transform: 'translate(-50%,-52%) scale(1)', opacity: .9, offset: .6 }, { transform: `translate(-50%,-52%) scale(${broke ? 1.25 : 1.1})`, opacity: 0 }], { duration: 700, easing: 'ease-out' });
}
export function fxHeal(arena, at) {
  for (let i = 0; i < 7; i++) {
    const x = rand(-44, 44), el = piece(arena, 'fx2-plus', { left: at.x + x + 'px', top: at.y + rand(-4, 22) + 'px' }, 1000 + i * 60, '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="#5be08a" stroke="#d9ffe6" stroke-width="1.6" stroke-linejoin="round"/></svg>');
    run(el, [{ transform: tr(0, 10, 'scale(.4)'), opacity: 0 }, { transform: tr(rand(-8, 8), -22, 'scale(1)'), opacity: 1, offset: .25 }, { transform: tr(rand(-14, 14), -80, 'scale(.7)'), opacity: 0 }], { duration: 900, delay: i * 60, easing: 'ease-out' });
  }
  fxShield(arena, at, '#5be08a');
}
export function fxPowerUp(arena, at, el = 'star') {
  const P = ELEMENTS[el];
  run(piece(arena, 'fx2-ring', { left: at.x + 'px', top: at.y + 'px', width: '130px', height: '130px', borderColor: P.c1, boxShadow: `0 0 18px ${P.c1}` }, 700), [{ transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.7)', opacity: 1, offset: .4 }, { transform: 'translate(-50%,-50%) scale(.45)', opacity: 0 }], { duration: 620, easing: 'ease-in' });
  for (let i = 0; i < 6; i++) {
    const x = rand(-46, 46), bit = piece(arena, 'fx2-up', { left: at.x + x + 'px', top: at.y + 40 + 'px', '--c1': P.c1, '--c2': P.c2 }, 900 + i * 50);
    run(bit, [{ transform: tr(0, 0, 'scaleY(.3)'), opacity: 0 }, { transform: tr(0, -30, 'scaleY(1)'), opacity: 1, offset: .3 }, { transform: tr(0, -110, 'scaleY(.6)'), opacity: 0 }], { duration: 760, delay: i * 50, easing: 'ease-out' });
  }
}
export function fxToxic(arena, at) {
  for (let i = 0; i < 6; i++) {
    const x = rand(-40, 40), el = piece(arena, 'fx2-bit toxic', { left: at.x + x + 'px', top: at.y + rand(0, 26) + 'px' }, 1000 + i * 70, svg('toxic', 'toxic', Math.round(rand(14, 24))));
    run(el, [{ transform: tr(0, 6, 'scale(.3)'), opacity: 0 }, { transform: tr(rand(-8, 8), -26, 'scale(1)'), opacity: .95, offset: .3 }, { transform: tr(rand(-14, 14), -78, 'scale(1.25)'), opacity: 0 }], { duration: 900, delay: i * 70, easing: 'ease-out' });
  }
}

/* ---------- 가장자리 (HP 위험 · 피버) ---------- */
// A glow along the arena edge that stays while it is on: `low` (my HP is almost gone: a red
// heartbeat) and `fever` (the last seconds: flames along the floor). Not counted in FX2_MAX.
export function fxEdge(arena, kind, on) {
  if (!arena) return;
  const id = `fx2-edge-${kind}`, el = arena.querySelector('#' + id);
  if (on && !el) {
    const box = document.createElement('div');
    box.id = id; box.className = `fx2-edge ${kind}`; box.setAttribute('aria-hidden', 'true');
    arena.appendChild(box);
  } else if (!on && el) el.remove();
}

/* ---------- 콤보 등급 ---------- */
export const COMBO_RANKS = [[12, 'UNSTOPPABLE!', '#ff2d55'], [8, 'AMAZING!', '#b266ff'], [5, 'GREAT!', '#ff7a1a'], [3, 'NICE!', '#ffd23f']];
export const comboRank = n => COMBO_RANKS.find(([min]) => n === min) || null;
export function fxRank(arena, at, text, color) {
  const el = piece(arena, 'fx2-rank', { left: at.x + 'px', top: at.y + 'px', '--c': color }, 1100, `<b>${text}</b>`);
  run(el, [{ transform: 'translate(-50%,-50%) scale(.3) rotate(-8deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.25) rotate(-5deg)', opacity: 1, offset: .2 }, { transform: 'translate(-50%,-62%) scale(1) rotate(-5deg)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,-90%) scale(.9) rotate(-5deg)', opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.2,1.4,.4,1)' });
}
// Rings of heat around my pet while the combo is hot (n >= 5): a class the CSS draws.
export const auraLevel = n => n >= 12 ? 3 : n >= 8 ? 2 : n >= 5 ? 1 : 0;
