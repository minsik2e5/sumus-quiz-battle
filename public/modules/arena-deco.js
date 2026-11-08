// V13.236 펫 아레나 경기장 꾸미기(화면). 새 재화 없음: 코인 판 승리 누적으로 열린다(목록 arena-deco-rules.js, 서버 server/arena-deco.mjs).
//   꾸미기 탭: 위에 큰 미리보기(경기장 · 링 · 내 펫 입장 효과 · 승리 포즈), 아래 칸 4개(경기장 · 링 · 입장 효과 · 승리 포즈).
//   잠긴 것은 "N승 더" 막대와 함께 미리보기만 된다. 고른 것은 이 폰에 기억하고 판 시작 요청에 실어 보내면 서버가 열렸는지 본다.
//   판에 붙이기: 경기장(혼자 판 · 친구 판은 방장 것) · 링 · 입장 효과(사람마다, 상대에게도 보인다) · 이기면 승리 포즈.
// 그림(주문서 68, public/assets/arena/bg-sky · ring-rune · entry-thunder …)이 오면 ARENA_ART로 같은 자리가 그림으로 바뀐다.
//   그림이 없으면 CSS로 그린 장면 · 링 · 효과(완성된 모습). 없는 그림은 요청하지 않는다(404 없음).
// 렉 방지: 서버 요청 없음(꾸미기 탭은 화면만). 입장 효과는 한 사람에 조각 3개(저사양 1개) · 1.6초 뒤 지움, 장면 꾸밈은 transform · opacity
//   애니메이션만(저사양 · 움직임 줄이기면 멈춤). 판 중에는 아무것도 새로 만들지 않는다(시작 때 한 번 · 이겼을 때 한 번).
import { esc, num } from './ui.js';
import { CHARACTERS } from './core.js';
import { DECO, DECO_SLOTS, DECO_KO, DECO_DEF, BASE_BG, decoItem, decoFull, decoBg, decoNext, cleanDeco } from './arena-deco-rules.js';
import { ARENA_ART } from './arena-art.js';
import { arenaUi } from './arena.js';

const KEY = () => `sumus-arena-deco:${arenaUi.R()?.A?.data?.profile?.id || ''}`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const $ = id => document.getElementById(id);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const SCENES = DECO.bg.map(x => x.k).filter(k => k !== 'auto' && !BASE_BG.includes(k));
const BASE_ART = { plaza: 'bg-plaza', forest: 'bg-forest', night: 'bg-night' };
const BASE_BACKUP = { plaza: 'battle/bg-arena', forest: 'battle/bg-forest', night: 'battle/bg-boss' };
let D = null; // 꾸미기 탭 상태 { tab, look: { slot: k } 미리보기 중인 것 }

/* ---------- 고른 것 ---------- */
const view = () => arenaUi.R()?.view?.deco || { wins: 0, dc: { ...DECO_DEF } };
export const decoWins = () => Number(view().wins || 0);
// 지금 고른 꾸미기(서버에 기억한 것 위에 이 폰에서 고른 것, 열린 것만).
export const decoMine = () => decoFull({ ...(view().dc || {}), ...cleanDeco(load(KEY(), {})) }, decoWins());
// 판 시작 · 친구 방 요청에 싣는 것(열린 것만 보낸다: 서버가 한 번 더 본다).
export const decoWant = () => { try { return decoMine(); } catch { return null; } };

/* ---------- 경기장 배경 ---------- */
// 꾸미기 장면 칸(CSS 장면). 그림이 오면 <img>가 그 그림을 보여 주고 장면 칸은 빛 · 움직임만 남는다.
const sceneHtml = k => `<div class="dc-scene sc-${k}" aria-hidden="true"><i class="sc-sky"></i><i class="sc-far"></i><i class="sc-floor"><b></b></i><i class="sc-fx a"></i><i class="sc-fx b"></i><i class="sc-fx c"></i></div>`;
// 경기장 배경 붙이기. 기본 3개는 false(예전 setBg가 그대로 한다), 새 경기장이면 true.
export function decoStage(stage, img, name) {
  if (!stage || !img) return false;
  stage.querySelector('.dc-scene')?.remove();
  stage.classList.remove(...SCENES.map(k => `dc-${k}`), 'dc-css');
  if (!SCENES.includes(name)) return false;
  stage.classList.add(`dc-${name}`);
  img.insertAdjacentHTML('afterend', sceneHtml(name)); // 그림자 막(.ar-shade) 아래
  if (ARENA_ART.has(`bg-${name}`)) {
    img.onload = () => stage.classList.add('art');
    img.onerror = () => { img.onerror = null; img.removeAttribute('src'); stage.classList.remove('art'); stage.classList.add('dc-css'); };
    img.src = `/assets/arena/bg-${name}.webp`;
  } else {
    img.onload = img.onerror = null; img.removeAttribute('src');
    stage.classList.remove('art'); stage.classList.add('dc-css');
  }
  return true;
}
export const decoBgOf = r => decoBg(r?.deco?.bg, r?.seed);

/* ---------- 판에 붙이기 ---------- */
// 판 화면을 만든 뒤 한 번: 링 모양 · 입장 효과(시작할 때 한 번).
export function decoMount(R) {
  const d = R?.r?.deco || null, field = $('ar-field');
  if (!field) return;
  const ring = field.querySelector('.ar-ring'), rg = d?.rg && decoItem('rg', d.rg) ? d.rg : 'basic';
  if (ring) ringOn(ring, rg);
  if (R.live?.late && !R.live?.practice) return; // 다시 들어옴: 입장 연출 없이
  const en = d?.en || {};
  const slots = R.slotList || ['me', 'foe'];
  slots.forEach((who, i) => { const k = en[who]; if (k) setTimeout(() => entryFx(R, who, k), 260 + i * 380); });
}
function ringOn(ring, rg) {
  ring.className = `ar-ring rg-${rg}${rg !== 'basic' ? ' rg-on' : ''}${ARENA_ART.has(`ring-${rg}`) ? ' art' : ''}`;
  ring.style.setProperty('--art', ARENA_ART.has(`ring-${rg}`) ? `url(/assets/arena/ring-${rg}.webp)` : 'none');
  if (rg !== 'basic' && !ring.firstChild) ring.innerHTML = '<i></i><i></i><i></i>';
}
const ENTRY_SFX = { basic: ['swoosh', { rate: 1.3 }], smoke: ['swoosh', { rate: .8 }], thunder: ['ult-impact', { rate: 1.4, volume: .7 }], flame: ['skill', { rate: .8 }], rainbow: ['skill', { rate: 1.4 }] };
// 입장 효과: 펫 자리에 조각 3개(저사양 1개), 펫 몸은 클래스로 1.2초 등장 애니메이션.
export function entryFx(R, who, k, host = null) {
  if (!R || R.closing) return;
  const mon = host ? null : $(`ar-${who}`), field = host || $('ar-field');
  if (!field || (!host && !mon)) return;
  const at = host ? { x: field.clientWidth / 2, y: field.clientHeight * .62 } : (() => { const v = R.cur?.[who]; const g = { w: field.clientWidth, h: field.clientHeight }; return v ? { x: v.x / 100 * g.w, y: v.y / 100 * g.h } : { x: g.w / 2, y: g.h / 2 }; })();
  const art = ARENA_ART.has(`entry-${k}`) ? `url(/assets/arena/entry-${k}.webp)` : '';
  const lite = R.lite || reduced();
  const parts = lite ? ['core'] : ['core', 'ring', 'bits'];
  for (const p of parts) {
    const el = document.createElement('i');
    el.className = `dc-en en-${k} ${p}${art && p === 'core' ? ' art' : ''}`;
    el.style.left = `${Math.round(at.x)}px`; el.style.top = `${Math.round(at.y)}px`;
    if (art && p === 'core') el.style.setProperty('--art', art);
    field.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
  const body = host ? host.querySelector('.dc-pv-pet') : mon;
  if (body) { body.classList.remove(...DECO.en.map(x => `dc-in-${x.k}`)); void body.offsetWidth; body.classList.add(`dc-in-${k}`); setTimeout(() => body.classList.remove(`dc-in-${k}`), 1300); }
  if (!host || D) { const [s, o] = ENTRY_SFX[k] || ENTRY_SFX.basic; arenaUi.sfx(s, o); }
}
// 이겼을 때 내 펫 승리 포즈(배너와 같이 1.4초).
export function decoWin(R, host = null) {
  const ps = host ? D?.look?.ps || decoMine().ps : R?.r?.deco?.ps || decoMine().ps;
  const mon = host ? host.querySelector('.dc-pv-pet') : $('ar-me'), field = host || $('ar-field');
  if (!mon || !field) return;
  mon.classList.remove(...DECO.ps.map(x => `dc-ps-${x.k}`)); void mon.offsetWidth;
  mon.classList.add('dc-win', `dc-ps-${ps}`);
  setTimeout(() => mon.classList.remove('dc-win', `dc-ps-${ps}`), 1800);
  if (ps === 'basic' || R?.lite || reduced()) return;
  const v = host ? null : R.cur?.me, g = { w: field.clientWidth, h: field.clientHeight };
  const at = v ? { x: v.x / 100 * g.w, y: v.y / 100 * g.h } : { x: g.w / 2, y: g.h * .62 };
  const art = ps === 'crown' && ARENA_ART.has('pose-crown') ? 'url(/assets/arena/pose-crown.webp)' : '';
  for (const p of ps === 'crown' ? ['spot', 'crown', 'confetti'] : ps === 'spin' ? ['stars', 'ring'] : ['ring']) {
    const el = document.createElement('i');
    el.className = `dc-ps ps-${ps} ${p}${art && p === 'crown' ? ' art' : ''}`;
    if (art && p === 'crown') el.style.setProperty('--art', art);
    el.style.left = `${Math.round(at.x)}px`; el.style.top = `${Math.round(at.y)}px`;
    field.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}
// 친구 판: 방이 보낸 꾸미기(경기장 · 링은 방장 것, 입장 효과는 자리마다) → 내 화면 칸(me · foe · o2 …).
export function liveDecoOf(d, mySide, slotOf) {
  if (!d) return null;
  const en = {};
  for (const [side, k] of Object.entries(d.en || {})) { const slot = side === mySide ? 'me' : slotOf(side); if (slot && decoItem('en', k)) en[slot] = k; }
  return { bg: decoItem('bg', d.bg) ? d.bg : 'auto', rg: decoItem('rg', d.rg) ? d.rg : 'basic', en };
}
// 혼자 판: 내 꾸미기 + 상대 팀 주인의 입장 효과(친구 팀이면).
export const soloDeco = r => { const m = decoMine(); return { bg: m.bg, rg: m.rg, ps: m.ps, en: { me: m.en, ...(r?.foe?.en && decoItem('en', r.foe.en) ? { foe: r.foe.en } : r?.foe?.bot ? {} : { foe: 'basic' }) } }; };

/* ---------- 꾸미기 탭 ---------- */
export function openDeco() {
  const R = arenaUi.R(); if (!R) return;
  arenaUi.stop(); arenaUi.bg('plaza');
  D = { tab: D?.tab || 'bg', look: { ...decoMine() } };
  draw(true);
}
export const closeDeco = () => { D = null; };
const pctOf = (w, wins) => Math.max(0, Math.min(100, Math.round(wins / Math.max(1, w) * 100)));
function preview() {
  const R = arenaUi.R(), pets = (R.A.data.stats?.pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level);
  const p = pets.find(x => x.key === R.team?.[0]) || pets[0];
  const L = D.look, bgName = decoBg(L.bg, 0), base = BASE_BG.includes(bgName);
  const src = base ? (ARENA_ART.has(BASE_ART[bgName]) ? `/assets/arena/${BASE_ART[bgName]}.webp` : `/assets/${BASE_BACKUP[bgName]}.webp`) : ARENA_ART.has(`bg-${bgName}`) ? `/assets/arena/bg-${bgName}.webp` : '';
  const pet = p ? `<img src="/assets/pets/${esc(p.key)}-${Math.max(1, Math.min(3, Number(p.form)))}.webp" alt="${esc(CHARACTERS[p.key]?.ko || p.key)}" draggable="false" decoding="async">` : '<b class="dc-pv-egg">🥚</b>';
  return `<div class="dc-pv${src ? ' has-img' : ''} dc-${bgName}" id="dc-pv">
    ${src ? `<img class="dc-pv-bg" src="${src}" alt="" draggable="false" decoding="async">` : ''}${base ? '' : sceneHtml(bgName)}
    <div class="dc-pv-field" id="dc-pv-field"><div class="ar-ring" id="dc-pv-ring"></div><span class="dc-pv-pet ar-mon me">${pet}</span></div>
    <div class="dc-pv-tags">${DECO_SLOTS.map(s => `<span><small>${DECO_KO[s]}</small>${esc(decoItem(s, L[s])?.icon || '')} ${esc(decoItem(s, L[s])?.n || '')}</span>`).join('')}</div>
    <div class="dc-pv-btns"><button type="button" class="dc-pv-play" data-ar="dc-play" data-what="en">▶ 입장</button><button type="button" class="dc-pv-play" data-ar="dc-play" data-what="ps">▶ 승리 포즈</button></div>
  </div>`;
}
function card(slot, x, wins, mine) {
  const lock = x.w > wins, on = mine[slot] === x.k, look = D.look[slot] === x.k;
  const thumb = slot === 'bg' ? `<i class="dc-thumb bg ${x.k === 'auto' ? 'auto' : `dc-${x.k}`}${x.k !== 'auto' && (ARENA_ART.has(`bg-${x.k}`) || BASE_ART[x.k] && ARENA_ART.has(BASE_ART[x.k])) ? ' art' : ''}" style="${x.k !== 'auto' && ARENA_ART.has(`bg-${x.k}`) ? `--art:url(/assets/arena/bg-${x.k}.webp)` : BASE_ART[x.k] && ARENA_ART.has(BASE_ART[x.k]) ? `--art:url(/assets/arena/${BASE_ART[x.k]}.webp)` : ''}"></i>`
    : slot === 'rg' ? `<i class="dc-thumb rg"><b class="ar-ring rg-${x.k}${x.k !== 'basic' ? ' rg-on' : ''}${ARENA_ART.has(`ring-${x.k}`) ? ' art' : ''}" style="--art:${ARENA_ART.has(`ring-${x.k}`) ? `url(/assets/arena/ring-${x.k}.webp)` : 'none'}">${x.k !== 'basic' ? '<i></i><i></i><i></i>' : ''}</b></i>`
    : `<i class="dc-thumb ${slot} t-${x.k}">${esc(x.icon)}</i>`;
  return `<button type="button" class="dc-item${lock ? ' lock' : ''}${on ? ' on' : ''}${look ? ' look' : ''}" data-ar="dc-pick" data-slot="${slot}" data-k="${esc(x.k)}" aria-pressed="${on}">
    ${thumb}<span class="dc-item-t"><b>${esc(x.n)}</b><small>${esc(x.d)}</small></span>
    ${lock ? `<span class="dc-lock"><em>🔒 ${num(x.w - wins)}승 더</em><span class="dc-bar"><i style="width:${pctOf(x.w, wins)}%"></i></span><small>${num(wins)} / ${num(x.w)}승</small></span>` : on ? '<span class="dc-on">✓ 사용 중</span>' : x.w ? `<span class="dc-open">${num(x.w)}승 달성</span>` : '<span class="dc-open">기본</span>'}
  </button>`;
}
function draw(first = false) {
  const R = arenaUi.R(); if (!R || !D) return;
  const wins = decoWins(), mine = decoMine(), next = decoNext(wins);
  const total = DECO_SLOTS.reduce((n, s) => n + DECO[s].length, 0), open = DECO_SLOTS.reduce((n, s) => n + DECO[s].filter(x => x.w <= wins).length, 0);
  arenaUi.main(`<section class="ar-deco${first ? ' first' : ''}">
    <div class="ar-title"><small>이긴 횟수로 열려요 · 코인 · 재화 없음</small><h1>경기장 꾸미기</h1></div>
    <div class="dc-wins"><span class="dc-trophy">🏆</span><div><b>${num(wins)}<small>승</small></b><small>코인 판 승리 누적 · 열림 ${open} / ${total}</small></div>
      ${next ? `<div class="dc-next"><small>다음: ${esc(DECO_KO[next.slot])} <b>${esc(decoItem(next.slot, next.k)?.icon || '')} ${esc(next.n)}</b></small><span class="dc-bar big"><i style="width:${pctOf(next.w, wins)}%"></i></span><em>${num(next.left)}승 더!</em></div>` : '<div class="dc-next all"><b>모두 열었어요! 👑</b></div>'}</div>
    ${preview()}
    <div class="dc-tabs" role="tablist">${DECO_SLOTS.map(s => `<button type="button" role="tab" class="dc-tab${D.tab === s ? ' on' : ''}" data-ar="dc-tab" data-slot="${s}" aria-selected="${D.tab === s}">${esc(DECO[s][1]?.icon || DECO[s][0].icon)} ${DECO_KO[s]}<small>${DECO[s].filter(x => x.w <= wins).length}/${DECO[s].length}</small></button>`).join('')}</div>
    <div class="dc-grid">${DECO[D.tab].map(x => card(D.tab, x, wins, mine)).join('')}</div>
    <p class="dc-note">${D.tab === 'en' ? '입장 효과는 <b>친구에게도 보여요</b>(친구 대전 · 내 팀을 만난 친구 화면).' : D.tab === 'bg' || D.tab === 'rg' ? '혼자 판과 <b>내가 방장인 친구 대전</b>에 적용돼요.' : '이기면 내 펫이 이 포즈를 해요.'} 잠긴 것도 눌러서 미리 볼 수 있어요.</p>
    <button type="button" class="yl-cta" data-ar="dc-back">대기실로</button>
  </section>`);
  const ring = $('dc-pv-ring'); if (ring) ringOn(ring, D.look.rg);
}
export function decoClick(act, b) {
  const R = arenaUi.R(); if (!R) return;
  if (act === 'dc-open') { arenaUi.sfx('tap'); return openDeco(); }
  if (!D) return;
  if (act === 'dc-back') { arenaUi.sfx('tap'); D = null; return arenaUi.lobby(); }
  if (act === 'dc-tab') { D.tab = DECO_SLOTS.includes(b.dataset.slot) ? b.dataset.slot : 'bg'; arenaUi.sfx('tap'); return draw(); }
  if (act === 'dc-play') { const host = $('dc-pv-field'); if (!host) return; return b.dataset.what === 'ps' ? (arenaUi.sfx('fanfare-epic', { volume: .5 }), decoWin(R, host)) : entryFx(R, 'me', D.look.en, host); }
  if (act === 'dc-pick') {
    const slot = b.dataset.slot, x = decoItem(slot, b.dataset.k); if (!x) return;
    D.look[slot] = x.k;
    if (x.w <= decoWins()) { save(KEY(), { ...cleanDeco(load(KEY(), {})), [slot]: x.k }); arenaUi.sfx('skill', { rate: 1.3, volume: .6 }); }
    else arenaUi.sfx('tap', { rate: .8 });
    draw();
    const host = $('dc-pv-field');
    if (host && slot === 'en') entryFx(R, 'me', x.k, host);
    if (host && slot === 'ps') decoWin(R, host);
  }
}
