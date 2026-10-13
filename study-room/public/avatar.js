// SUMUS 공부방 캐릭터: SVG 부품(머리/옷/안경/소품)을 조합해 그린다.
// 브라우저(window.Avatar)와 서버(require) 양쪽에서 같은 옵션 검증을 쓴다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Avatar = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HAIR = [
    { id: 'short', label: '짧은 머리' },
    { id: 'side', label: '옆가르마' },
    { id: 'curly', label: '곱슬' },
    { id: 'bob', label: '단발' },
    { id: 'long', label: '긴 머리' },
    { id: 'buns', label: '똥머리' }
  ];
  const HAIR_COLORS = ['#2e2523', '#5b3b2c', '#8a5b3c', '#c79d72', '#3b3e5e'];
  const TOPS = ['#f5f2ec', '#f5a8c8', '#8fd1a0', '#ff7b6b', '#6fa6ff', '#2f3557', '#ffd36a', '#b69dff'];
  const ITEMS = [
    { id: 'none', label: '없음' },
    { id: 'plant', label: '화분' },
    { id: 'books', label: '책 더미' },
    { id: 'pencil', label: '연필' },
    { id: 'cup', label: '컵' }
  ];
  const SKIN = '#f7d9c6';
  const SKIN_SHADE = '#eabfa8';

  const DEFAULT = { hair: 'short', hc: 0, top: 0, glasses: false, item: 'plant' };

  function pickIndex(value, length, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n < length ? n : fallback;
  }

  function normalize(input) {
    const a = input && typeof input === 'object' ? input : {};
    return {
      hair: HAIR.some((h) => h.id === a.hair) ? a.hair : DEFAULT.hair,
      hc: pickIndex(a.hc, HAIR_COLORS.length, DEFAULT.hc),
      top: pickIndex(a.top, TOPS.length, DEFAULT.top),
      glasses: a.glasses === true,
      item: ITEMS.some((i) => i.id === a.item) ? a.item : DEFAULT.item
    };
  }

  function random() {
    const r = (n) => Math.floor(Math.random() * n);
    return {
      hair: HAIR[r(HAIR.length)].id,
      hc: r(HAIR_COLORS.length),
      top: r(TOPS.length),
      glasses: Math.random() < 0.3,
      item: ITEMS[1 + r(ITEMS.length - 1)].id
    };
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amount)));
    const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  let uid = 0;

  // pose: 'study'(고개 숙이고 책 보기) | 'rest'(정면 보기)
  function svg(input, opts) {
    const a = normalize(input);
    const pose = opts && opts.pose === 'rest' ? 'rest' : 'study';
    const id = 'av' + (++uid);
    const hair = HAIR_COLORS[a.hc];
    const top = TOPS[a.top];
    const cx = 100;
    const cy = pose === 'study' ? 80 : 72;
    const r = 44;
    const eyeY = pose === 'study' ? cy + 17 : cy + 7;
    const coversEars = a.hair === 'bob' || a.hair === 'long' || a.hair === 'buns';
    const parts = [];

    parts.push(`<defs>
      <radialGradient id="${id}s" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#fde7da"/><stop offset="1" stop-color="${SKIN}"/></radialGradient>
      <radialGradient id="${id}h" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="${shade(hair, 38)}"/><stop offset="1" stop-color="${hair}"/></radialGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(top, 18)}"/><stop offset="1" stop-color="${shade(top, -14)}"/></linearGradient>
      <clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${r + 1.5}"/></clipPath>
    </defs>`);

    // 몸통(후드티)
    parts.push(`<path d="M42 150 C42 120 68 110 100 110 C132 110 158 120 158 150 Z" fill="url(#${id}t)"/>`);
    parts.push(`<path d="M86 112 Q100 128 114 112" fill="none" stroke="${shade(top, -32)}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`);
    parts.push(`<line x1="93" y1="122" x2="92" y2="136" stroke="${shade(top, -40)}" stroke-width="2" stroke-linecap="round" opacity=".45"/><line x1="107" y1="122" x2="108" y2="136" stroke="${shade(top, -40)}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`);

    // 뒷머리
    if (a.hair === 'long') {
      parts.push(`<path d="M${cx - r - 6} ${cy} C${cx - r - 8} ${cy - r - 8} ${cx + r + 8} ${cy - r - 8} ${cx + r + 6} ${cy} L${cx + r + 4} 146 Q${cx + r - 6} 150 ${cx + r - 14} 146 L${cx - r + 14} 146 Q${cx - r + 6} 150 ${cx - r - 4} 146 Z" fill="url(#${id}h)"/>`);
    } else if (a.hair === 'bob' || a.hair === 'buns') {
      if (a.hair === 'buns') {
        parts.push(`<circle cx="${cx - 34}" cy="${cy - 38}" r="17" fill="url(#${id}h)"/><circle cx="${cx + 34}" cy="${cy - 38}" r="17" fill="url(#${id}h)"/>`);
      }
      parts.push(`<path d="M${cx - r - 7} ${cy + 4} C${cx - r - 8} ${cy - r - 10} ${cx + r + 8} ${cy - r - 10} ${cx + r + 7} ${cy + 4} L${cx + r + 6} ${cy + 26} Q${cx + r - 4} ${cy + 33} ${cx + r - 12} ${cy + 26} L${cx - r + 12} ${cy + 26} Q${cx - r + 4} ${cy + 33} ${cx - r - 6} ${cy + 26} Z" fill="url(#${id}h)"/>`);
    }

    // 귀
    if (!coversEars) {
      parts.push(`<circle cx="${cx - r + 1}" cy="${cy + 8}" r="9" fill="${SKIN_SHADE}"/><circle cx="${cx + r - 1}" cy="${cy + 8}" r="9" fill="${SKIN_SHADE}"/>`);
    }

    // 얼굴
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/>`);

    // 앞머리(얼굴 원에 맞춰 잘라서 그린다)
    const topY = cy - r - 4;
    const L = cx - r - 4;
    const R = cx + r + 4;
    let bang;
    const base = pose === 'study' ? cy + 2 : cy - 12;
    if (a.hair === 'short') {
      bang = `M${L} ${topY} L${R} ${topY} L${R} ${base + 2} Q${cx} ${base - 8} ${L} ${base + 2} Z`;
    } else if (a.hair === 'side') {
      bang = `M${L} ${topY} L${R} ${topY} L${R} ${base + 4} Q${cx + 10} ${base - 4} ${cx - 8} ${base - 18} Q${cx - 26} ${base - 4} ${L} ${base + 6} Z`;
    } else if (a.hair === 'curly') {
      let d = `M${L} ${topY} L${R} ${topY} L${R} ${base}`;
      const n = 6;
      const step = (R - L) / n;
      for (let i = 0; i < n; i += 1) {
        const x1 = R - step * i;
        const x2 = R - step * (i + 1);
        d += ` Q${(x1 + x2) / 2} ${base + 12} ${x2} ${base}`;
      }
      bang = d + ' Z';
    } else {
      const b = base + 4;
      bang = `M${L} ${topY} L${R} ${topY} L${R} ${b + 6} Q${cx} ${b - 2} ${L} ${b + 6} Z`;
    }
    parts.push(`<g clip-path="url(#${id}c)"><path d="${bang}" fill="url(#${id}h)"/></g>`);
    if (a.hair === 'long' || a.hair === 'bob' || a.hair === 'buns') {
      // 옆머리
      parts.push(`<path d="M${cx - r - 2} ${cy - 10} Q${cx - r + 6} ${cy + 14} ${cx - r + 4} ${cy + 26} L${cx - r - 6} ${cy + 26} Z" fill="url(#${id}h)"/>`);
      parts.push(`<path d="M${cx + r + 2} ${cy - 10} Q${cx + r - 6} ${cy + 14} ${cx + r - 4} ${cy + 26} L${cx + r + 6} ${cy + 26} Z" fill="url(#${id}h)"/>`);
    }
    parts.push(`<path d="M${cx - 22} ${cy - r + 10} Q${cx - 6} ${cy - r + 2} ${cx + 8} ${cy - r + 6}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>`);

    // 눈, 볼, 입
    parts.push(`<ellipse cx="${cx - 15}" cy="${eyeY}" rx="3.6" ry="${pose === 'study' ? 3.4 : 4.4}" fill="#2a2222"/><ellipse cx="${cx + 15}" cy="${eyeY}" rx="3.6" ry="${pose === 'study' ? 3.4 : 4.4}" fill="#2a2222"/>`);
    parts.push(`<ellipse cx="${cx - 26}" cy="${eyeY + 9}" rx="6.5" ry="4" fill="#ff9a9a" opacity=".35"/><ellipse cx="${cx + 26}" cy="${eyeY + 9}" rx="6.5" ry="4" fill="#ff9a9a" opacity=".35"/>`);
    if (pose === 'rest') {
      parts.push(`<path d="M${cx - 5} ${eyeY + 13} Q${cx} ${eyeY + 17} ${cx + 5} ${eyeY + 13}" fill="none" stroke="#7a4b40" stroke-width="2.2" stroke-linecap="round"/>`);
    }
    if (a.glasses) {
      parts.push(`<g fill="none" stroke="#3a3330" stroke-width="2.6"><circle cx="${cx - 15}" cy="${eyeY}" r="10"/><circle cx="${cx + 15}" cy="${eyeY}" r="10"/><path d="M${cx - 5} ${eyeY} Q${cx} ${eyeY - 3} ${cx + 5} ${eyeY}"/></g>`);
    }

    // 책상
    parts.push(`<rect x="0" y="146" width="200" height="54" fill="#eac39a"/><rect x="0" y="146" width="200" height="6" fill="#f4d4ae"/>`);

    // 책과 손
    if (pose === 'study') {
      parts.push(`<path d="M100 156 L66 151 L60 172 L100 176 Z" fill="#fffdf8" stroke="#e3d8c8" stroke-width="1.5"/><path d="M100 156 L134 151 L140 172 L100 176 Z" fill="#fffdf8" stroke="#e3d8c8" stroke-width="1.5"/>`);
      parts.push(`<g stroke="#d9cdbb" stroke-width="1.4"><line x1="72" y1="158" x2="94" y2="161"/><line x1="70" y1="163" x2="94" y2="166"/><line x1="106" y1="161" x2="128" y2="158"/><line x1="106" y1="166" x2="130" y2="163"/></g>`);
      parts.push(`<ellipse cx="62" cy="162" rx="9" ry="7" fill="${SKIN}"/><ellipse cx="138" cy="162" rx="9" ry="7" fill="${SKIN}"/>`);
    } else {
      parts.push(`<rect x="70" y="156" width="56" height="12" rx="3" fill="#ff8b7b"/><rect x="72" y="158" width="52" height="3" fill="#fff" opacity=".6"/>`);
      parts.push(`<ellipse cx="64" cy="160" rx="9" ry="7" fill="${SKIN}"/><ellipse cx="136" cy="160" rx="9" ry="7" fill="${SKIN}"/>`);
    }

    // 책상 소품
    if (a.item === 'plant') {
      parts.push(`<path d="M163 150 L181 150 L178 168 L166 168 Z" fill="#e0805a"/><circle cx="168" cy="142" r="6" fill="#5fb36a"/><circle cx="176" cy="140" r="6.5" fill="#6cc277"/><circle cx="172" cy="134" r="6" fill="#58a862"/>`);
    } else if (a.item === 'books') {
      parts.push(`<rect x="158" y="156" width="30" height="9" rx="2" fill="#4f7fd9"/><rect x="161" y="148" width="26" height="8" rx="2" fill="#5fbf8a"/><rect x="163" y="160" width="20" height="2" fill="#fff" opacity=".5"/>`);
    } else if (a.item === 'pencil') {
      parts.push(`<g transform="rotate(-18 170 160)"><rect x="152" y="157" width="34" height="6" rx="1.5" fill="#ffcf4a"/><path d="M186 157 L194 160 L186 163 Z" fill="#f2c9a0"/><rect x="149" y="157" width="5" height="6" fill="#ff8fa3"/></g>`);
    } else if (a.item === 'cup') {
      parts.push(`<rect x="162" y="144" width="18" height="22" rx="4" fill="#fff" stroke="#e0d6c8" stroke-width="1.5"/><path d="M180 149 Q188 151 180 160" fill="none" stroke="#e0d6c8" stroke-width="3"/><rect x="164" y="148" width="14" height="5" fill="#8a5a3b" opacity=".75"/>`);
    }

    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">${parts.join('')}</svg>`;
  }

  // 혼자 모드 등에서 쓰는 얼굴만 있는 동그란 아이콘
  function face(input) {
    return svg(input, { pose: 'rest' }).replace('viewBox="0 0 200 200"', 'viewBox="46 20 108 108"');
  }

  return { HAIR, HAIR_COLORS, TOPS, ITEMS, DEFAULT, normalize, random, svg, face };
});
