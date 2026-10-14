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

  const DEFAULT = { hair: 'short', hc: 0, top: 0, glasses: false, item: 'plant', kind: null };

  // 이미지 에셋 캐릭터 (public/characters/<id>.png, 3×2 칸 스프라이트 시트, 칸당 512px)
  // unlock: 누적 공부 시간(시간)이 이만큼 되어야 고를 수 있다
  const CHARACTERS = [
    { id: 'bear', name: '콩떡곰', unlock: 0 },
    { id: 'bunny', name: '말랑토끼', unlock: 0 },
    { id: 'cat', name: '치즈냥', unlock: 0 },
    { id: 'penguin', name: '펭펭', unlock: 0 },
    { id: 'puppy', name: '누렁멍', unlock: 0 },
    { id: 'owl', name: '부엉박사', unlock: 0 },
    { id: 'squirrel', name: '도토리', unlock: 0 },
    { id: 'otter', name: '해달이', unlock: 0 },
    { id: 'seal', name: '물범떡', unlock: 5 },
    { id: 'octopus', name: '문어쌤', unlock: 10 },
    { id: 'mochi', name: '찰떡이', unlock: 15 },
    { id: 'potato', name: '감자꾼', unlock: 20 },
    { id: 'riceball', name: '주먹밥', unlock: 30 },
    { id: 'tofu', name: '두부', unlock: 40 },
    { id: 'ghost', name: '꼬마유령', unlock: 50 },
    { id: 'dino', name: '아기공룡', unlock: 70 },
    { id: 'cloud', name: '구름이', unlock: 85 },
    { id: 'star', name: '별똥이', unlock: 100 }
  ];
  const SPRITE_CELL = { study: 0, look: 1, rest: 2, yawn: 3, sleep: 4, cheer: 5 };
  const available = new Set();
  const readyCallbacks = [];
  let detecting = null;

  // 브라우저에서 어떤 캐릭터 이미지가 실제로 올라와 있는지 확인한다 (없는 캐릭터는 고를 수 없음)
  function detect() {
    if (detecting || typeof Image === 'undefined') return detecting;
    detecting = Promise.all(CHARACTERS.map((c) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { available.add(c.id); resolve(); };
      img.onerror = () => resolve();
      img.src = `/characters/${c.id}.png`;
    }))).then(() => { for (const cb of readyCallbacks) cb(); });
    return detecting;
  }

  function onReady(cb) {
    readyCallbacks.push(cb);
    detect();
  }

  function character(id) {
    return CHARACTERS.find((c) => c.id === id) || null;
  }

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
      item: ITEMS.some((i) => i.id === a.item) ? a.item : DEFAULT.item,
      kind: CHARACTERS.some((c) => c.id === a.kind) ? a.kind : null
    };
  }

  function random() {
    const r = (n) => Math.floor(Math.random() * n);
    return {
      hair: HAIR[r(HAIR.length)].id,
      hc: r(HAIR_COLORS.length),
      top: r(TOPS.length),
      glasses: Math.random() < 0.3,
      item: ITEMS[1 + r(ITEMS.length - 1)].id,
      kind: null
    };
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amount)));
    const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  let uid = 0;

  // 앞머리 끝선: 가운데는 base, 양옆으로 갈수록 sideDrop만큼 내려가며 locks개의 머리카락 끝이 tip만큼 늘어진다
  function bangEdge(cx, r, base, { locks, tip, sideDrop, tilt = 0, sharp = false }) {
    const L = cx - r - 8;
    const R = cx + r + 8;
    const yAt = (x) => base + Math.pow(Math.abs(x - cx) / r, 2) * sideDrop + (x - cx) * tilt;
    let d = `L${R} ${yAt(R).toFixed(1)}`;
    const step = (R - L) / locks;
    for (let i = 0; i < locks; i += 1) {
      const x1 = R - step * i;
      const x2 = R - step * (i + 1);
      const mx = (x1 + x2) / 2;
      const t = tip * (0.75 + 0.5 * ((i * 37) % 7) / 7);
      if (sharp) d += ` Q${(mx + step * 0.15).toFixed(1)} ${(yAt(mx) + t * 0.4).toFixed(1)} ${mx.toFixed(1)} ${(yAt(mx) + t).toFixed(1)} Q${(mx - step * 0.1).toFixed(1)} ${(yAt(x2) + t * 0.3).toFixed(1)} ${x2.toFixed(1)} ${yAt(x2).toFixed(1)}`;
      else d += ` Q${mx.toFixed(1)} ${(yAt(mx) + t * 2).toFixed(1)} ${x2.toFixed(1)} ${yAt(x2).toFixed(1)}`;
    }
    return { d, L, R };
  }

  // 자세별 그림: 고개(숙임/듦), 눈, 입, 책, 사람 유무
  const POSES = {
    study: { up: false, eyes: 'down', mouth: null, book: 'open' }, // 고개 숙이고 책 보기
    rest: { up: true, eyes: 'open', mouth: 'smile', book: 'closed' }, // 쉬는 중
    cheer: { up: true, eyes: 'open', mouth: 'smile', book: 'open' }, // 화이팅 (확인 창, 목표 달성)
    look: { up: true, eyes: 'open', mouth: null, book: 'open' }, // 공부 중 고개 듦 (카메라)
    yawn: { up: true, eyes: 'closed', mouth: 'open', book: 'open' }, // 하품 (카메라)
    sleep: { up: false, eyes: 'closed', mouth: null, book: 'open' }, // 조는 중 (카메라)
    empty: { person: false, book: 'open' } // 자리 비움 (카메라)
  };

  function svg(input, opts) {
    const a = normalize(input);
    const pose = POSES[opts && opts.pose] ? opts.pose : 'study';
    if (a.kind && available.has(a.kind) && pose !== 'empty') return spriteSvg(a, pose, opts);
    const P = POSES[pose];
    const person = P.person !== false;
    const study = !P.up;
    const id = 'av' + (++uid);
    const hair = HAIR_COLORS[a.hc];
    const hairDark = shade(hair, -22);
    const top = TOPS[a.top];
    const topDark = shade(top, -38);
    const cx = 100;
    const cy = study ? 84 : 76;
    const r = 47;
    const eyeY = study ? cy + 19 : cy + 9;
    const longish = a.hair === 'bob' || a.hair === 'long' || a.hair === 'buns';
    const p = [];

    p.push(`<defs>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcf8f3"/><stop offset="1" stop-color="#f2e9df"/></linearGradient>
      <radialGradient id="${id}s" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="#fff2ea"/><stop offset=".55" stop-color="${SKIN}"/><stop offset="1" stop-color="#ecc1aa"/></radialGradient>
      <radialGradient id="${id}e" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e8b49c"/><stop offset="1" stop-color="#f3cdb8"/></radialGradient>
      <radialGradient id="${id}h" cx="38%" cy="22%" r="85%"><stop offset="0" stop-color="${shade(hair, 46)}"/><stop offset=".5" stop-color="${hair}"/><stop offset="1" stop-color="${hairDark}"/></radialGradient>
      <radialGradient id="${id}t" cx="35%" cy="15%" r="95%"><stop offset="0" stop-color="${shade(top, 26)}"/><stop offset=".6" stop-color="${top}"/><stop offset="1" stop-color="${shade(top, -26)}"/></radialGradient>
      <radialGradient id="${id}b" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff8f8f" stop-opacity=".55"/><stop offset="1" stop-color="#ff8f8f" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#7a4a2a" stop-opacity=".22"/><stop offset="1" stop-color="#7a4a2a" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d2ac"/><stop offset="1" stop-color="#e2b385"/></linearGradient>
      <clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${r + 0.5}"/></clipPath>
      <clipPath id="${id}k"><rect x="0" y="0" width="200" height="${longish ? 200 : a.hair === 'curly' ? cy + 16 : cy + 6}"/></clipPath>
    </defs>`);

    // 벽과 그림자 (bare면 벽은 바깥 배경을 쓴다)
    if (!(opts && opts.bare)) p.push(`<rect width="200" height="200" fill="url(#${id}w)"/>`);
    p.push(`<ellipse cx="100" cy="132" rx="82" ry="48" fill="url(#${id}sh)" opacity=".55"/>`);

    if (!person) {
      // 빈 의자
      p.push(`<rect x="58" y="92" width="84" height="70" rx="16" fill="#c9976a"/><rect x="64" y="98" width="72" height="58" rx="12" fill="#d8a97b"/><path d="M72 104 Q100 98 128 104" stroke="#e8c39b" stroke-width="4" fill="none" stroke-linecap="round"/>`);
    } else {
    // 몸통(후드티)
    p.push(`<path d="M30 160 C30 128 58 114 100 114 C142 114 170 128 170 160 Z" fill="url(#${id}t)"/>`);
    p.push(`<path d="M64 121 Q100 104 136 121 Q118 134 100 134 Q82 134 64 121 Z" fill="${topDark}" opacity=".45"/>`);
    p.push(`<ellipse cx="${cx}" cy="${cy + r - 2}" rx="30" ry="9" fill="${topDark}" opacity=".35"/>`);
    p.push(`<g stroke="${shade(top, top === '#2f3557' ? 120 : 60)}" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M91 131 Q90 140 92 148"/><path d="M109 131 Q110 140 108 148"/></g><circle cx="92" cy="149" r="2.2" fill="${shade(top, top === '#2f3557' ? 120 : 60)}"/><circle cx="108" cy="149" r="2.2" fill="${shade(top, top === '#2f3557' ? 120 : 60)}"/>`);

    // 뒷머리(머리 볼륨)
    const backTop = cy - r - 7;
    if (a.hair === 'long') {
      p.push(`<path d="M${cx - r - 8} ${cy - 4} C${cx - r - 10} ${backTop - 2} ${cx + r + 10} ${backTop - 2} ${cx + r + 8} ${cy - 4} C${cx + r + 12} ${cy + 30} ${cx + r + 10} 128 ${cx + r + 6} 150 Q${cx + r - 6} 156 ${cx + r - 16} 150 L${cx + r - 24} ${cy + 30} L${cx - r + 24} ${cy + 30} L${cx - r + 16} 150 Q${cx - r + 6} 156 ${cx - r - 6} 150 C${cx - r - 10} 128 ${cx - r - 12} ${cy + 30} ${cx - r - 8} ${cy - 4} Z" fill="url(#${id}h)"/>`);
      p.push(`<g stroke="${hairDark}" stroke-width="1.6" opacity=".5" fill="none" stroke-linecap="round"><path d="M${cx - r - 2} ${cy + 20} Q${cx - r - 4} ${cy + 50} ${cx - r + 4} 146"/><path d="M${cx + r + 2} ${cy + 20} Q${cx + r + 4} ${cy + 50} ${cx + r - 4} 146"/></g>`);
    } else if (a.hair === 'bob' || a.hair === 'buns') {
      if (a.hair === 'buns') {
        for (const s of [-1, 1]) {
          p.push(`<circle cx="${cx + s * 36}" cy="${cy - 40}" r="19" fill="url(#${id}h)"/><path d="M${cx + s * 36 - 11} ${cy - 50} Q${cx + s * 36} ${cy - 56} ${cx + s * 36 + 9} ${cy - 49}" stroke="#fff" stroke-opacity=".3" stroke-width="4" fill="none" stroke-linecap="round"/>`);
        }
      }
      const end = a.hair === 'bob' ? cy + 34 : cy + 24;
      p.push(`<path d="M${cx - r - 9} ${cy} C${cx - r - 10} ${backTop - 4} ${cx + r + 10} ${backTop - 4} ${cx + r + 9} ${cy} L${cx + r + 8} ${end - 4} Q${cx + r + 6} ${end + 4} ${cx + r - 6} ${end} L${cx - r + 6} ${end} Q${cx - r - 6} ${end + 4} ${cx - r - 8} ${end - 4} Z" fill="url(#${id}h)"/>`);
    } else if (a.hair === 'curly') {
      let bumps = '';
      for (let i = 0; i <= 10; i += 1) {
        const ang = Math.PI * (0.95 + i * 0.11);
        bumps += `<circle cx="${(cx + Math.cos(ang) * (r + 2)).toFixed(1)}" cy="${(cy - 6 + Math.sin(ang) * (r + 0)).toFixed(1)}" r="12" fill="url(#${id}h)"/>`;
      }
      p.push(`<g clip-path="url(#${id}k)">${bumps}</g>`);
    } else {
      p.push(`<g clip-path="url(#${id}k)"><ellipse cx="${cx}" cy="${cy - 5}" rx="${r + 5}" ry="${r + 4}" fill="url(#${id}h)"/></g>`);
    }

    // 귀
    if (!longish) {
      for (const s of [-1, 1]) {
        p.push(`<ellipse cx="${cx + s * (r - 1)}" cy="${cy + 9}" rx="9" ry="10" fill="url(#${id}s)"/><ellipse cx="${cx + s * (r)}" cy="${cy + 9}" rx="4.5" ry="5.5" fill="url(#${id}e)"/>`);
      }
    }

    // 얼굴
    p.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/>`);

    // 눈, 볼, 코, 입
    for (const s of [-1, 1]) {
      const ex = cx + s * 16;
      if (P.eyes === 'closed') {
        p.push(`<path d="M${ex - 5} ${eyeY} Q${ex} ${eyeY + 4} ${ex + 5} ${eyeY}" fill="none" stroke="#2a2120" stroke-width="2.4" stroke-linecap="round"/>`);
      } else {
        p.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="4.2" ry="${P.eyes === 'down' ? 3.6 : 5}" fill="#2a2120"/>`);
        if (P.eyes === 'open') p.push(`<circle cx="${ex - 1.3}" cy="${eyeY - 2}" r="1.5" fill="#fff"/>`);
      }
      p.push(`<ellipse cx="${cx + s * 28}" cy="${eyeY + 10}" rx="9" ry="6" fill="url(#${id}b)"/>`);
    }
    p.push(`<ellipse cx="${cx}" cy="${eyeY + 6}" rx="2.2" ry="1.5" fill="#e3a98f" opacity=".7"/>`);
    if (P.mouth === 'smile') p.push(`<path d="M${cx - 4.5} ${eyeY + 13} Q${cx} ${eyeY + 17} ${cx + 4.5} ${eyeY + 13}" fill="none" stroke="#8a4e43" stroke-width="2" stroke-linecap="round"/>`);
    if (P.mouth === 'open') p.push(`<ellipse cx="${cx}" cy="${eyeY + 17}" rx="5.5" ry="7" fill="#8a3f3a"/><ellipse cx="${cx}" cy="${eyeY + 20}" rx="3.4" ry="2.6" fill="#ff8f8f"/>`);

    // 앞머리
    const base = study ? cy - 2 : cy - 13;
    const cfg = {
      short: { locks: 6, tip: 4, sideDrop: 20, sharp: true },
      side: { locks: 4, tip: 5, sideDrop: 18, tilt: -0.22, sharp: true },
      curly: { locks: 8, tip: 4.5, sideDrop: 16 },
      bob: { locks: 7, tip: 1.6, sideDrop: 30 },
      long: { locks: 7, tip: 1.6, sideDrop: 30 },
      buns: { locks: 7, tip: 1.6, sideDrop: 30 }
    }[a.hair];
    const edge = bangEdge(cx, r, a.hair === 'side' ? base - 2 : base, cfg);
    const topY = cy - r - 10;
    p.push(`<g clip-path="url(#${id}c)"><path d="M${edge.L} ${topY} L${edge.R} ${topY} ${edge.d} Z" fill="url(#${id}h)"/>`);
    // 머리카락 결
    p.push(`<g stroke="${hairDark}" stroke-width="1.3" opacity=".28" fill="none" stroke-linecap="round"><path d="M${cx - 14} ${base - 16} Q${cx - 17} ${base - 6} ${cx - 20} ${base + 3}"/><path d="M${cx + 12} ${base - 16} Q${cx + 15} ${base - 6} ${cx + 17} ${base + 3}"/></g></g>`);
    if (longish) {
      for (const s of [-1, 1]) {
        p.push(`<path d="M${cx + s * (r + 6)} ${cy - 18} Q${cx + s * (r - 10)} ${cy + 6} ${cx + s * (r - 6)} ${cy + 30} Q${cx + s * (r + 2)} ${cy + 30} ${cx + s * (r + 8)} ${cy + 24} Z" fill="url(#${id}h)"/>`);
      }
    }
    // 머리 광택
    p.push(`<path d="M${cx - 30} ${cy - r + 16} Q${cx - 6} ${cy - r + 1} ${cx + 22} ${cy - r + 12}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="5" stroke-linecap="round"/>`);
    p.push(`<path d="M${cx + 28} ${cy - r + 17} Q${cx + 32} ${cy - r + 20} ${cx + 34} ${cy - r + 24}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="4" stroke-linecap="round"/>`);

    if (a.glasses) {
      p.push(`<g fill="#fff" fill-opacity=".14" stroke="#3a302d" stroke-width="2.4"><circle cx="${cx - 16}" cy="${eyeY}" r="10.5"/><circle cx="${cx + 16}" cy="${eyeY}" r="10.5"/></g><path d="M${cx - 5.5} ${eyeY - 1} Q${cx} ${eyeY - 4} ${cx + 5.5} ${eyeY - 1}" fill="none" stroke="#3a302d" stroke-width="2.4"/>`);
    }

    }

    // 책상
    p.push(`<rect x="0" y="152" width="200" height="48" fill="url(#${id}d)"/><rect x="0" y="152" width="200" height="3" fill="#fbe3c6"/>`);
    p.push(`<ellipse cx="100" cy="171" rx="60" ry="9" fill="#8a5530" opacity=".13"/>`);

    // 팔과 손
    for (const s of (person ? [-1, 1] : [])) {
      const hx = P.book === 'open' ? cx + s * 40 : cx + s * 36;
      p.push(`<path d="M${cx + s * 58} 136 Q${cx + s * 62} 156 ${hx + s * 4} 162 L${hx - s * 6} 156 Q${cx + s * 50} 146 ${cx + s * 46} 132 Z" fill="url(#${id}t)"/>`);
      p.push(`<ellipse cx="${hx}" cy="160" rx="9.5" ry="7.5" fill="url(#${id}s)"/>`);
    }

    // 책
    if (P.book === 'open') {
      p.push(`<path d="M64 156 L136 156 L140 176 L60 176 Z" fill="#7aa3e6"/>`);
      p.push(`<path d="M100 157 Q84 151 66 154 L62 172 Q82 169 100 174 Z" fill="#fffdf7"/><path d="M100 157 Q116 151 134 154 L138 172 Q118 169 100 174 Z" fill="#fbf6ec"/>`);
      p.push(`<path d="M100 157 L100 174" stroke="#d9cbb5" stroke-width="1.6"/>`);
      p.push(`<g stroke="#dccfbd" stroke-width="1.3" stroke-linecap="round"><path d="M72 159 Q84 157 95 160"/><path d="M71 163 Q84 161 95 164"/><path d="M70 167 Q82 165 95 168"/><path d="M105 160 Q116 157 128 159"/><path d="M105 164 Q116 161 129 163"/></g>`);
      if (person) for (const s of [-1, 1]) p.push(`<ellipse cx="${cx + s * 40}" cy="164" rx="9.5" ry="7.5" fill="url(#${id}s)"/>`);
    } else {
      p.push(`<rect x="70" y="160" width="60" height="13" rx="3" fill="#ff8b7b"/><rect x="70" y="160" width="60" height="4" rx="2" fill="#fff" opacity=".55"/><rect x="74" y="164" width="52" height="2" fill="#fff" opacity=".5"/>`);
    }

    p.push(itemSvg(a.item));

    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">${p.join('')}</svg>`;
  }

  // 책상 소품
  function itemSvg(item) {
    const p = [];
    if (item === 'plant') {
      p.push(`<ellipse cx="172" cy="172" rx="13" ry="3" fill="#7a4a2a" opacity=".18"/><path d="M162 153 L182 153 L179 171 L165 171 Z" fill="#e48a62"/><rect x="161" y="151" width="22" height="5" rx="2" fill="#ef9d77"/><path d="M172 151 Q160 140 162 132 Q172 136 172 151 Q174 138 184 134 Q186 144 172 151" fill="#62b56d"/><path d="M172 151 Q170 136 172 128 Q178 138 172 151" fill="#78c983"/>`);
    } else if (item === 'books') {
      p.push(`<ellipse cx="173" cy="172" rx="17" ry="3" fill="#7a4a2a" opacity=".18"/><rect x="156" y="160" width="34" height="11" rx="2" fill="#4f7fd9"/><rect x="158" y="162" width="30" height="2.5" fill="#fff" opacity=".6"/><rect x="160" y="150" width="28" height="10" rx="2" fill="#5fbf8a"/><rect x="162" y="152" width="24" height="2.5" fill="#fff" opacity=".6"/>`);
    } else if (item === 'pencil') {
      p.push(`<g transform="rotate(-20 170 164)"><rect x="150" y="161" width="36" height="6.5" rx="2" fill="#ffcf4a"/><rect x="150" y="161" width="36" height="2.2" fill="#fff" opacity=".45"/><path d="M186 161 L195 164.2 L186 167.5 Z" fill="#f2c9a0"/><path d="M192 163.2 L195 164.2 L192 165.3 Z" fill="#3a302d"/><rect x="146" y="161" width="5" height="6.5" rx="1.5" fill="#ff8fa3"/></g>`);
    } else if (item === 'cup') {
      p.push(`<ellipse cx="172" cy="172" rx="14" ry="3" fill="#7a4a2a" opacity=".18"/><path d="M181 154 Q192 156 181 166" fill="none" stroke="#efe6da" stroke-width="3.5"/><rect x="161" y="148" width="22" height="24" rx="5" fill="#fffdf9"/><ellipse cx="172" cy="149" rx="10" ry="2.6" fill="#8a5a3b"/><rect x="163" y="150" width="3" height="18" rx="1.5" fill="#fff" opacity=".8"/>`);
    }

    return p.join('');
  }

  // 이미지 캐릭터: 벽·책상·소품은 SVG로 그리고, 그 위에 스프라이트 시트의 해당 칸을 얹는다
  function spriteSvg(a, pose, opts) {
    const cell = SPRITE_CELL[pose] != null ? SPRITE_CELL[pose] : 0;
    const col = cell % 3;
    const row = Math.floor(cell / 3);
    const id = 'sp' + (++uid);
    const p = [];
    p.push(`<defs><linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcf8f3"/><stop offset="1" stop-color="#f2e9df"/></linearGradient><linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d2ac"/><stop offset="1" stop-color="#e2b385"/></linearGradient></defs>`);
    if (!(opts && opts.bare)) p.push(`<rect width="200" height="200" fill="url(#${id}w)"/>`);
    // 칸 안에서 책상 윗면은 y≈420/512 → 200 기준 약 164
    p.push(`<rect x="0" y="162" width="200" height="38" fill="url(#${id}d)"/><rect x="0" y="162" width="200" height="3" fill="#fbe3c6"/>`);
    p.push(`<ellipse cx="100" cy="178" rx="62" ry="8" fill="#8a5530" opacity=".12"/>`);
    p.push(`<svg x="0" y="0" width="200" height="200" style="width:200px;height:200px" viewBox="${col * 512} ${row * 512} 512 512"><image href="/characters/${a.kind}.png" width="1536" height="1024"/></svg>`);
    p.push(`<g transform="translate(0 10)">${itemSvg(a.item)}</g>`);
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">${p.join('')}</svg>`;
  }

  // 혼자 모드 등에서 쓰는 얼굴만 있는 동그란 아이콘
  function face(input) {
    return svg(input, { pose: 'rest' }).replace('viewBox="0 0 200 200"', 'viewBox="46 20 108 108"');
  }

  return { HAIR, HAIR_COLORS, TOPS, ITEMS, DEFAULT, CHARACTERS, POSES: Object.keys(POSES), normalize, random, svg, face, detect, onReady, character, isAvailable: (id) => available.has(id) };
});
