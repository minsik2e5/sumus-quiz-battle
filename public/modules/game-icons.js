// V13.150 손그림 게임 아이콘(보물 사냥 · 짝 맞추기). 이모지 대신 쓴다: 기기마다 모양이 다르지 않고 화면 그림체와 맞는다.
// 모두 32×32, 진한 갈색 잉크 외곽선(2.2) + 적은 색. gi('chest') → <svg class="gi gi-chest">…
const INK = '#2b1d12';
const C = { gold: '#e8a930', goldD: '#b9791c', red: '#c4473a', blue: '#3b78b5', green: '#4e9a57', violet: '#7a5aa6', paper: '#f4e7c9', wood: '#9a6233', woodD: '#6b4423', steel: '#a9b4bd', white: '#fffaf0', teal: '#2f7f86' };
const st = (c = INK, w = 2.2) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const s = st();
const f = c => `fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`;

const ICONS = {
  chest: `<path ${f(C.wood)} d="M5 14h22v12H5z"/><path ${f(C.woodD)} d="M5 14c0-5 4-8 11-8s11 3 11 8z"/><path ${s} d="M5 18h22"/><rect ${f(C.gold)} x="13.5" y="15.5" width="5" height="6" rx="1"/>`,
  chestOpen: `<path ${f(C.wood)} d="M5 15h22v11H5z"/><path ${f(C.woodD)} d="M6 15 4 6c4-2 16-2 24 0l-2 9"/><circle ${f(C.gold)} cx="11" cy="14" r="3"/><circle ${f(C.gold)} cx="17" cy="12.5" r="3"/><circle ${f(C.gold)} cx="22" cy="14.5" r="2.6"/><path ${s} d="M5 19h22"/>`,
  coin: `<circle ${f(C.gold)} cx="16" cy="16" r="10"/><circle ${s} cx="16" cy="16" r="6"/><path ${s} d="M16 12v8"/>`,
  coins: `<ellipse ${f(C.goldD)} cx="16" cy="23" rx="10" ry="4"/><ellipse ${f(C.gold)} cx="16" cy="19" rx="10" ry="4"/><ellipse ${f(C.gold)} cx="14" cy="13" rx="7" ry="3.2"/><path ${s} d="M6 19v4M26 19v4"/>`,
  vault: `<rect ${f(C.steel)} x="4" y="5" width="24" height="22" rx="3"/><circle ${f(C.white)} cx="16" cy="16" r="7"/><path ${s} d="M16 11v10M11 16h10M12.5 12.5l7 7M19.5 12.5l-7 7"/><circle ${f(C.gold)} cx="16" cy="16" r="2"/>`,
  siren: `<path ${f(C.red)} d="M9 24v-8a7 7 0 0 1 14 0v8z"/><rect ${f(C.woodD)} x="6" y="24" width="20" height="4" rx="1.5"/><path ${s} d="M13 16a3 3 0 0 1 3-3M16 3v3M5 8l2 2M27 8l-2 2"/>`,
  shield: `<path ${f(C.blue)} d="M16 4 26 8v7c0 7-5 11-10 13-5-2-10-6-10-13V8z"/><path ${s} d="M16 9v15M11 14h10"/>`,
  thief: `<circle ${f(C.paper)} cx="16" cy="15" r="10"/><path ${f(INK)} d="M6 13h20v4H6z"/><circle fill="${C.white}" cx="12" cy="15" r="1.4"/><circle fill="${C.white}" cx="20" cy="15" r="1.4"/><path ${s} d="M12 21c2.5 1.6 5.5 1.6 8 0"/>`,
  swap: `<path ${s} d="M6 11h18l-4-4M26 21H8l4 4"/>`,
  x2: `<rect ${f(C.gold)} x="4" y="7" width="24" height="18" rx="4"/><path ${s} d="M9 12l6 8M15 12l-6 8M18 13c1-2 6-2 6 1 0 3-6 4-6 6h6"/>`,
  x3: `<rect ${f(C.red)} x="4" y="7" width="24" height="18" rx="4"/><path ${st(C.white)} d="M8 12l6 8M14 12l-6 8M18 12h5l-3 3c3 0 4 1.5 4 3s-2 3-5 2"/>`,
  puff: `<path ${f(C.white)} d="M8 21a5 5 0 0 1 1-10 6 6 0 0 1 11-1 5 5 0 0 1 4 9z"/><path ${s} d="M5 25h6M14 26h9"/>`,
  monster: `<path ${f(C.green)} d="M6 27V15a10 10 0 0 1 20 0v12l-3-3-3 3-4-3-4 3-3-3z"/><circle fill="${C.white}" stroke="${INK}" stroke-width="2" cx="12" cy="15" r="2.6"/><circle fill="${C.white}" stroke="${INK}" stroke-width="2" cx="20" cy="15" r="2.6"/><path ${s} d="M9 7 7 3M23 7l2-4"/>`,
  jackpot: `<path ${f(C.violet)} d="M16 4l11 9-11 15L5 13z"/><path ${s} d="M5 13h22M11 13l5 15 5-15M10 8l2 5M22 8l-2 5"/>`,
  gift: `<rect ${f(C.red)} x="5" y="12" width="22" height="15" rx="2"/><rect ${f(C.red)} x="4" y="9" width="24" height="5" rx="1.5"/><path ${s} d="M16 9v18M16 9c-3-6-9-4-6 0M16 9c3-6 9-4 6 0"/>`,
  eye: `<path ${f(C.white)} d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z"/><circle ${f(C.teal)} cx="16" cy="16" r="4.5"/><circle fill="${INK}" cx="16" cy="16" r="1.8"/>`,
  half: `<circle ${f(C.white)} cx="16" cy="16" r="11"/><path ${f(C.violet)} d="M16 5a11 11 0 0 1 0 22z"/><path ${s} d="M16 5v22"/>`,
  freeze: `<circle ${f('#cfe8f3')} cx="16" cy="17" r="10"/><path ${s} d="M16 11v6l4 3M13 4h6M16 4v3"/><path ${st(C.blue)} d="M7 9l2 2M25 9l-2 2"/>`,
  chain: `<rect ${f(C.gold)} x="4" y="11" width="13" height="10" rx="5" transform="rotate(-30 10.5 16)"/><rect ${f(C.gold)} x="15" y="11" width="13" height="10" rx="5" transform="rotate(-30 21.5 16)"/>`,
  sun: `<circle ${f(C.gold)} cx="16" cy="16" r="7"/><path ${s} d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/>`,
  ship: `<path ${f(C.woodD)} d="M4 20h24l-4 7H8z"/><path ${s} d="M16 4v16"/><path ${f(INK)} d="M16 5l9 6-9 3z"/><path ${s} d="M2 29c3-2 5-2 8 0s5 2 8 0 5-2 8 0"/>`,
  storm: `<path ${st(INK, 2.6)} d="M6 9c6-3 18-3 20 1M8 15c5-2 14-2 16 1M11 21c3-1.5 9-1.5 11 1M14 26c1.5-.6 4-.6 5 .5"/><circle ${f(C.gold)} cx="25" cy="21" r="2.4"/><circle ${f(C.gold)} cx="7" cy="23" r="2"/>`,
  flagA: `<path ${s} d="M7 4v24"/><path ${f(C.red)} d="M7 5h17l-4 5 4 5H7z"/>`,
  flagB: `<path ${s} d="M7 4v24"/><path ${f(C.blue)} d="M7 5h17l-4 5 4 5H7z"/>`,
  finish: `<path ${s} d="M7 4v24"/><path ${f(C.white)} d="M7 5h18v11H7z"/><path fill="${INK}" d="M7 5h4.5v3.7H7zM16 5h4.5v3.7H16zM11.5 8.7H16v3.6h-4.5zM20.5 8.7H25v3.6h-4.5zM7 12.3h4.5V16H7zM16 12.3h4.5V16H16z"/>`,
  star: `<path ${f(C.gold)} d="M16 3l3.9 8 8.6 1.2-6.3 6 1.6 8.6L16 22.7 8.2 26.8l1.6-8.6-6.3-6 8.6-1.2z"/>`,
  trophy: `<path ${f(C.gold)} d="M9 5h14v7a7 7 0 0 1-14 0z"/><path ${s} d="M9 8H5c0 4 2 6 5 6M23 8h4c0 4-2 6-5 6M16 19v4"/><rect ${f(C.woodD)} x="10" y="23" width="12" height="5" rx="1"/>`,
  crown: `<path ${f(C.gold)} d="M4 24 6 9l6 6 4-9 4 9 6-6 2 15z"/><path ${s} d="M5 24h22"/>`,
  medal1: `<path ${f(C.red)} d="M10 3h5l2 9h-5zM22 3h-5l-2 9h5z"/><circle ${f(C.gold)} cx="16" cy="20" r="8"/><path ${s} d="M15 17l2-1v8"/>`,
  medal2: `<path ${f(C.blue)} d="M10 3h5l2 9h-5zM22 3h-5l-2 9h5z"/><circle ${f(C.steel)} cx="16" cy="20" r="8"/><path ${s} d="M13.5 17.5c1-2 5-2 5 .5s-5 3-5 6h5"/>`,
  medal3: `<path ${f(C.green)} d="M10 3h5l2 9h-5zM22 3h-5l-2 9h5z"/><circle ${f('#c98a52')} cx="16" cy="20" r="8"/><path ${s} d="M13.5 17h5l-2.5 2.5c2 0 3 1 3 2.2s-1.5 2.4-4.5 1.6"/>`,
  worm: `<path ${st('#d9767a', 5)} d="M6 22c3-6 6 2 9-3s6 3 9-4"/><path ${s} d="M6 22c3-6 6 2 9-3s6 3 9-4"/><circle fill="${INK}" cx="24.5" cy="14.5" r="1"/>`,
  ghost: `<path ${f(C.white)} d="M7 27V14a9 9 0 0 1 18 0v13l-3-2.5-3 2.5-3-2.5-3 2.5-3-2.5z"/><circle fill="${INK}" cx="13" cy="14" r="1.6"/><circle fill="${INK}" cx="19" cy="14" r="1.6"/>`,
  bolt: `<path ${f(C.gold)} d="M18 3 6 18h8l-2 11 12-15h-8z"/>`,
  hourglass: `<path ${f(C.paper)} d="M8 4h16M8 28h16M10 4c0 7 12 7 12 12S10 21 10 28h12c0-7-12-7-12-12s12-5 12-12"/><path fill="${C.gold}" d="M12 26h8c-1-3-3-4-4-4s-3 1-4 4z"/>`,
  flame: `<path ${f(C.orange || '#d9783a')} d="M16 3c1 5 7 7 7 15a7 7 0 0 1-14 0c0-4 2-6 3-8 1 3 2 4 4 4-1-4-1-8 0-11z"/><path ${f(C.gold)} d="M16 15c1 2 3 3 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z"/>`,
  check: `<circle ${f(C.green)} cx="16" cy="16" r="11"/><path ${st(C.white, 3)} d="M11 16l3.5 3.5L21 13"/>`,
  cross: `<circle ${f(C.red)} cx="16" cy="16" r="11"/><path ${st(C.white, 3)} d="M12 12l8 8M20 12l-8 8"/>`
};
export const ICON_NAMES = Object.keys(ICONS);
ICONS.raid = ICONS.ship;
ICONS.bounty = ICONS.coins;
// V13.150 그림 30(public/assets/treasure)이 들어왔다: 이름이 있으면 그 아이콘은 그림으로 나온다(없으면 위 SVG).
export const TREASURE_ART = new Set(['bg-phone', 'bg-tv', 'chest-gold', 'chest-violet', 'chest-green', 'chest-open', 'item-fifty', 'item-freeze', 'item-saver', 'item-peek', 'vault', 'siren', 'bounty', 'ship', 'ev-golden', 'ev-raid', 'ev-storm', 'flags']);
const ART_ICON = { siren: 'siren', vault: 'vault', ship: 'ship', raid: 'ev-raid', sun: 'ev-golden', storm: 'ev-storm', eye: 'item-peek', half: 'item-fifty', freeze: 'item-freeze', chain: 'item-saver', bounty: 'bounty' };
export const treasureArt = name => TREASURE_ART.has(name) ? `/assets/treasure/${name}.webp` : '';
export const gi = (name, cls = '') => ART_ICON[name] && TREASURE_ART.has(ART_ICON[name]) ? `<img class="gi gi-${name} gi-art${cls ? ' ' + cls : ''}" src="${treasureArt(ART_ICON[name])}" alt="" draggable="false">` : ICONS[name] ? `<svg class="gi gi-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${ICONS[name]}</svg>` : '';
// 화면 글에 남은 이모지를 같은 그림체 아이콘으로 바꾼다(그리기 직전에 한 번). 표에 없는 이모지(낚시 🐟 등)는 그대로.
// 얼굴 이모지는 지운다(글로 충분하다).
const EMOJI = {
  '🦹': 'thief', '🔄': 'swap', '🛡️': 'shield', '🛡': 'shield', '🚨': 'siren', '👀': 'eye', '💰': 'coins', '🌟': 'sun', '☠️': 'raid', '☠': 'raid', '📜': 'bounty',
  '🌪️': 'storm', '🌪': 'storm', '⏱️': 'freeze', '⏱': 'freeze', '🔗': 'chain', '½': 'half', '🥇': 'medal1', '🥈': 'medal2', '🥉': 'medal3',
  '🔴': 'flagA', '🔵': 'flagB', '🎁': 'gift', '💨': 'puff', '🏆': 'trophy', '💎': 'jackpot', '👹': 'monster', '👑': 'crown', '🚀': 'bolt',
  '🏁': 'finish', '🪱': 'worm', '🔥': 'flame'
};
const FACES = ['😮‍💨', '😱', '😵', '😅', '🤝', '🤫'];
const RE = new RegExp(`${FACES.join('|')}|${Object.keys(EMOJI).sort((a, b) => b.length - a.length).join('|')}`, 'gu');
export const iconize = html => String(html).replace(RE, m => EMOJI[m] ? gi(EMOJI[m]) : '').replace(/<svg class="gi([^"]*)"([^>]*)><\/svg>/g, '');
