import { $, api, esc, num, toast } from './ui.js';
import { eggTapHtml, bindEggTap } from './pet-growth.js';
import { CHARACTERS, PET_FORMS, PET_NAME_MAX, EGG_PRICE, EPIC_EGG_PRICE, EPIC_EGG_LEGENDARY_RATE, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, LEGEND_EGG_PRICE, LEGEND_EGG_EPIC_NEED, SERIES_RANKS, seasonOnSale, cleanPetName } from './core.js';
import { epicShow, legendaryShow, mythicShow } from './lucky.js';
import { uiArt, ART_READY } from './emblems.js';
import { SERIES_EGG_ART } from './pet-art.js';
import { avatar, petKey } from './character.js';
import { playSound, preloadSound } from './sound.js';

// Pet moments: the hatch (egg -> baby) and evolution scenes shown on the home screen the
// first time a student's pet reaches a new form, plus the pet-name form.
// The last form a student has seen is kept per device, so each moment plays once.

const SEEN_KEY = (id, key) => `sumus:v13:pet-form:${id}:${key}`;
const readSeen = (id, key) => { try { const v = localStorage.getItem(SEEN_KEY(id, key)); return v === null ? null : Number(v); } catch { return null; } };
const writeSeen = (id, key, form) => { try { localStorage.setItem(SEEN_KEY(id, key), String(form)); } catch {} };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const petJosa = (word, withBatchim, without) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? withBatchim : without);
};
// pet is an entry of stats.pets (the active one is stats.pet).
export const petDisplayName = pet => pet?.name || CHARACTERS[petKey(pet?.key)].ko;

// Where the egg sits inside each egg sprite (percent of the canvas): centre and width.
const EGG_BOX = { dog: { x: 50, y: 50, w: 58 }, pig: { x: 50, y: 50, w: 58 }, default: { x: 50, y: 52, w: 40 } };
const HATCH_TAPS = 3;
const CRACKS = ['M18 46 L30 40 L38 50 L48 42', 'M48 42 L58 52 L68 44 L82 50', 'M26 62 L36 56 L46 64 L56 57 L66 65 L76 58'];
// Gaps (ms) between old/new silhouette swaps: slow at first, then a rapid shimmer.
const EVO_FLICKER = [460, 400, 340, 280, 230, 190, 150, 120, 95, 75, 60, 50, 45, 40, 40, 40];
const EVO_CHARGE_MS = 1300;

let momentOpen = false;

function burst(container, count, shards) {
  const colors = ['#ffd85a', '#12b886', '#ff9fb2', '#8fd3ff', '#ffffff'];
  container.innerHTML = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + Math.random() * .5, d = 80 + Math.random() * 70;
    const size = shards && i % 2 ? 10 + Math.random() * 12 : 8 + Math.random() * 10;
    return `<i class="${shards && i % 2 ? 'pet-shard' : 'pet-spark'}" style="--s:${size}px;--c:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 24}px;--r:${Math.random() * 540 - 270}deg"></i>`;
  }).join('');
}

function nameFormHtml(pet) {
  const fallback = CHARACTERS[petKey(pet.key)].ko;
  return `<form class="pet-name-form" novalidate>
    <label for="pet-name-input">우리 펫의 이름을 지어주세요</label>
    <input id="pet-name-input" name="pet_name" autocomplete="off" enterkeyhint="done" maxlength="24" placeholder="${esc(fallback)}" value="${esc(pet.name || '')}">
    <p class="pet-name-hint">한글·영어·숫자 ${PET_NAME_MAX}자까지 · 비워 두면 '${esc(fallback)}'(으)로 불러요</p>
    <p class="pet-name-error" role="alert"></p>
    <div class="pet-moment-actions"><button type="button" class="btn" data-pet-later>나중에</button><button type="submit" class="btn primary">이 이름으로 할게요</button></div>
  </form>`;
}

function bindNameForm(root, pet, done) {
  const form = root.querySelector('.pet-name-form'), input = form.querySelector('input'), error = form.querySelector('.pet-name-error');
  form.querySelector('[data-pet-later]').onclick = () => done(false);
  form.onsubmit = async event => {
    event.preventDefault();
    const { name, error: problem } = cleanPetName(input.value);
    if (problem) { error.textContent = problem; input.focus(); return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; error.textContent = '';
    try {
      await api('/profile/pet-name', { pet_name: name });
      pet.name = name;
      toast(name ? `이제 ${petJosa(name, '이', '')}라고 불러요!` : '기본 이름으로 불러요.');
      done(true);
    } catch (err) { error.textContent = err.message; submit.disabled = false; }
  };
  setTimeout(() => input.focus({ preventScroll: true }), 60);
}

function openOverlay(label) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop pet-moment-backdrop"><section class="modal pet-moment" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button class="icon-button modal-close" data-pet-close aria-label="닫기"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg></button><div class="pet-moment-body"></div></section></div>`;
  $('.pet-moment').onkeydown = e => { if (e.key === 'Escape') $('[data-pet-close]')?.click(); };
  return $('.pet-moment-body');
}

function hatchScene(body, key, name, onHatched) {
  const box = EGG_BOX[key] || EGG_BOX.default;
  body.innerHTML = `<div class="pet-hatch" data-state="idle">
    <div class="pet-stage">
      <div class="pet-glow"></div>
      <div class="pet-layer pet-hatch-baby">${avatar(key, { form: 1, expression: 'happy' })}</div>
      <div class="pet-layer pet-hatch-egg" role="button" tabindex="0" aria-label="알 두드리기">
        ${avatar(key, { form: 0 })}
        <svg class="pet-cracks" viewBox="0 0 100 100" style="left:${box.x - box.w / 2}%;top:${box.y - box.w / 2}%;width:${box.w}%;height:${box.w}%">${CRACKS.map(d => `<path d="${d}"/>`).join('')}</svg>
      </div>
      <div class="pet-flash"></div>
      <div class="pet-bits"></div>
    </div>
    <p class="pet-moment-msg" aria-live="polite">알이 꿈틀거려요! 톡톡 두드려 보세요</p>
    <div class="pet-hatch-dots">${'<span></span>'.repeat(HATCH_TAPS)}</div>
    <div class="pet-moment-actions"><button type="button" class="btn" data-pet-auto>자동으로 보기</button></div>
  </div>`;
  const scene = body.querySelector('.pet-hatch'), egg = body.querySelector('.pet-hatch-egg'), msg = body.querySelector('.pet-moment-msg');
  let taps = 0, busy = false, autoTimer = 0;
  const tap = () => {
    if (busy || scene.dataset.state === 'hatched') return;
    taps++;
    scene.dataset.state = 'tapping';
    body.querySelectorAll('.pet-hatch-dots span').forEach((s, i) => s.classList.toggle('on', i < taps));
    body.querySelectorAll('.pet-cracks path').forEach((p, i) => p.classList.toggle('on', i < taps));
    egg.classList.remove('wobble', 'big'); void egg.offsetWidth;
    egg.classList.add('wobble'); if (taps > 1) egg.classList.add('big');
    // V13.116 sound: a knock that rises with each tap, cracks from the second tap
    if (taps === 1) preloadSound(['pop', 'fanfare-basic']);
    playSound('wiggle', { rate: 1 + taps * .12, vary: .02 }); if (taps > 1) playSound('crack', { rate: .9 + taps * .08, gain: taps < HATCH_TAPS ? .7 : 1, at: .04 });
    if (taps < HATCH_TAPS) { msg.textContent = taps === 1 ? '앗, 금이 갔어요!' : '조금만 더! 한 번만 더 두드려요'; return; }
    busy = true; clearTimeout(autoTimer);
    msg.textContent = '알이 빛나기 시작했어요…';
    scene.dataset.state = 'charging';
    setTimeout(() => {
      const flash = body.querySelector('.pet-flash'); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      burst(body.querySelector('.pet-bits'), 24, true);
      playSound('pop'); playSound('fanfare-basic', { at: .15 });
      scene.dataset.state = 'hatched';
      msg.innerHTML = `<b>${esc(petJosa(name, '이', '가'))}</b> 태어났어요!`;
      body.querySelector('.pet-moment-actions').remove();
      body.querySelector('.pet-hatch-dots').remove();
      onHatched();
    }, reducedMotion() ? 0 : 1100);
  };
  egg.addEventListener('click', tap);
  egg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
  body.querySelector('[data-pet-auto]').onclick = () => { const step = () => { tap(); if (taps < HATCH_TAPS) autoTimer = setTimeout(step, 700); }; step(); };
  setTimeout(() => egg.focus({ preventScroll: true }), 60);
}

function evolveScene(body, key, name, from, to, onEvolved) {
  body.innerHTML = `<div class="pet-evo" data-state="ready">
    <span class="pet-evo-chip">${from}단계 · ${PET_FORMS[from]} → ${to}단계 · ${PET_FORMS[to]}</span>
    <div class="pet-stage">
      <div class="pet-evo-rays"></div>
      <div class="pet-glow"></div>
      <div class="pet-layer pet-evo-from">${avatar(key, { form: from })}</div>
      <div class="pet-layer pet-evo-to">${avatar(key, { form: to, expression: 'happy' })}</div>
      <div class="pet-evo-ring"></div><div class="pet-evo-ring r2"></div>
      <div class="pet-flash"></div>
      <div class="pet-bits"></div>
    </div>
    <p class="pet-moment-msg" aria-live="polite">어? ${esc(name)}의 모습이 달라지려고 해요!</p>
    <div class="pet-moment-actions"><button type="button" class="btn primary" data-pet-evolve>진화 시작</button></div>
  </div>`;
  const scene = body.querySelector('.pet-evo'), stage = body.querySelector('.pet-stage'), msg = body.querySelector('.pet-moment-msg');
  const finish = () => {
    stage.classList.add('show-to');
    const flash = body.querySelector('.pet-flash'); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    burst(body.querySelector('.pet-bits'), 18, false);
    playSound('burst', { rate: 1.1, gain: .8 }); playSound('levelup', { at: .2 });
    scene.dataset.state = 'done';
    msg.innerHTML = `<b>${esc(petJosa(name, '이', '가'))}</b> ${PET_FORMS[to]} 모습으로 진화했어요!`;
    onEvolved();
  };
  body.querySelector('[data-pet-evolve]').onclick = () => {
    body.querySelector('.pet-moment-actions').remove();
    preloadSound(['combo', 'tick', 'burst', 'levelup']);
    if (reducedMotion()) return finish();
    scene.dataset.state = 'charging';
    playSound('combo', { rate: .7 });
    setTimeout(() => {
      scene.dataset.state = 'flicker';
      msg.textContent = `${petJosa(name, '이', '가')} 진화하고 있어요!`;
      let t = 0;
      EVO_FLICKER.forEach((gap, i) => { t += gap; setTimeout(() => { stage.classList.toggle('show-to', i % 2 === 0); playSound('tick', { rate: 1 + i * .06, gain: .7 }); }, t); });
      setTimeout(finish, t + 350);
    }, EVO_CHARGE_MS);
  };
}

function closeOverlay(changed, onChanged) {
  $('#modal-root').innerHTML = '';
  momentOpen = false;
  if (changed) onChanged?.();
}

// The basic egg just bought: whose egg it is (shared by the shop window and the 놀이터 egg stand).
// V13.162 lead: 맨 위 한 줄을 바꿀 때(몬스터 사냥: "○○이 새 친구가 됐어요!").
function eggRevealHtml(body, key, done, lead = null) {
  const name = CHARACTERS[key].ko;
  body.innerHTML = `<div class="pet-shop">
    <p class="pet-moment-msg">${lead || `<b>${esc(petJosa(name, '이', ''))}</b>의 알이에요!`}</p>
    <div class="pet-shop-reveal etp-host">${eggTapHtml(key, name, 'shop')}</div>
    <p class="pet-shop-copy">지금부터 ${esc(petJosa(name, '과', '와'))} 함께 공부해요.<br>Lv.3이 되면 알이 깨져요.</p>
    <div class="pet-moment-actions"><button type="button" class="btn primary" data-pet-done>좋아요!</button></div>
  </div>`;
  body.querySelector('[data-pet-done]').onclick = done;
  $('[data-pet-close]').onclick = done;
  bindEggTap(body);
}
// V13.107 놀이터 알 상점: buy an egg straight from the egg stand (no shop window first), then the
// same reveal as the shop window: a basic egg's name card, the 영웅 or the legendary show.
// V13.150 `via`: 같은 알 깨기 연출을 다른 곳에서(낚시터 진주 교환소: { path: '/reel/exchange', body: { item } }).
export async function buyEgg(A, onChanged, kind, via = null) {
  if (momentOpen || !A.data?.stats?.pet) return null;
  // V13.197.1 놀이터 전설 알: 받은 알이 있으면 열고, 아니면 산다(알 상점 창의 전설 알 탭과 같은 경로 · 연출).
  if (kind === 'legend') {
    momentOpen = true;
    let res;
    try { res = await api(A.data.legend_egg?.waiting ? '/legend-egg/open' : '/legend-egg/buy', {}); }
    finally { momentOpen = false; }
    onChanged?.();
    await legendEggResultShow(res);
    return res;
  }
  momentOpen = true;
  let res;
  try { res = await api(via?.path || '/shop/egg', via?.body || { kind: ['epic', 'season', 'series'].includes(kind) ? kind : 'basic' }); }
  finally { momentOpen = false; }
  // V13.197.1 곤충 · 공룡 알: 시리즈 영웅 · 렉스는 연출, 시리즈 기본은 아래 알 이름 카드.
  if (res.mythic || res.legendary || res.epic || res.limited || (res.series && res.rank !== 'basic')) { onChanged?.(); await eggShow(res, kind); return res; }
  momentOpen = true;
  eggRevealHtml(openOverlay('새 알'), res.key, () => closeOverlay(true, onChanged));
  return res;
}

// Call after each student render; plays a moment when the pet has reached a new form.
export function maybePetMoment(A, onChanged) {
  const p = A.data?.profile, pet = A.data?.stats?.pet;
  if (momentOpen || A.screen || A.tab !== 'home' || p?.role !== 'student' || !pet || $('#modal-root').children.length) return;
  const form = Number(pet.form || 0);
  let seen = readSeen(p.id, pet.key);
  if (seen === null) {
    // First look at this pet on this device. A first pet that was still an egg under the
    // old Lv.5 rule gets its hatch; any other pet starts from what it is now.
    seen = pet.first && form >= 1 && pet.level < 5 ? 0 : form;
    writeSeen(p.id, pet.key, seen);
  }
  if (form <= seen) { if (form < seen) writeSeen(p.id, pet.key, form); return; }
  momentOpen = true;
  const key = petKey(pet.key);
  const body = openOverlay(seen === 0 ? '부화' : '진화');
  let named = false;
  $('[data-pet-close]').onclick = () => { writeSeen(p.id, pet.key, form); closeOverlay(named, onChanged); };
  const finished = () => {
    writeSeen(p.id, pet.key, form);
    const next = document.createElement('div');
    next.className = 'pet-moment-next';
    if (seen === 0 && !pet.name) {
      next.innerHTML = nameFormHtml(pet);
      body.appendChild(next);
      bindNameForm(next, pet, saved => { named = saved; closeOverlay(saved, onChanged); });
    } else {
      next.innerHTML = '<div class="pet-moment-actions"><button type="button" class="btn primary" data-pet-done>좋아요!</button></div>';
      body.appendChild(next);
      next.querySelector('[data-pet-done]').onclick = () => closeOverlay(false, onChanged);
      next.querySelector('[data-pet-done]').focus({ preventScroll: true });
    }
  };
  if (seen === 0) hatchScene(body, key, petDisplayName(pet), finished);
  else evolveScene(body, key, petDisplayName(pet), Math.max(1, seen), form, finished);
}

// Rename the active pet from the home or pet screen.
export function openPetNameModal(A, onChanged) {
  const pet = A.data.stats?.pet;
  if (momentOpen || !pet) return;
  momentOpen = true;
  const body = openOverlay('펫 이름 짓기');
  body.innerHTML = `<div class="pet-name-solo"><div class="pet-name-avatar">${avatar(pet.key, { form: Math.max(1, pet.form), expression: 'happy' })}</div>${nameFormHtml(pet)}</div>`;
  $('[data-pet-close]').onclick = () => closeOverlay(false, onChanged);
  bindNameForm(body, pet, saved => closeOverlay(saved, onChanged));
}

// Shop: buy a random egg, then reveal which pet's egg it was.
// V13.92: two eggs. The basic egg (a basic pet not met yet) and the 영웅 알 (a 영웅 pet not
// met yet); a 영웅 egg opens with its own show.
const EGGS = {
  basic: { name: '랜덤 알', price: EGG_PRICE, keys: STANDARD_PET_KEYS, all: '기본 펫을 모두 모았어요!' },
  epic: { name: '영웅 알', price: EPIC_EGG_PRICE, keys: EPIC_PET_KEYS, all: '영웅 펫을 모두 모았어요!' }
};
// V13.109: the season's egg joins the shop while its season is on.
const eggsNow = () => { const s = seasonOnSale(); return s ? { ...EGGS, season: { name: s.egg, price: s.price, keys: s.keys, all: `${s.name} 한정 펫을 모두 모았어요!`, until: s.until } } : EGGS; };
// After a purchase: the legendary, 영웅 or limited show, or the basic egg's name card (null).
// V13.160 선생님이 보낸 알도 알 상점과 같은 알 깨기 연출로(예전: 선물 상자 안에 펫 카드만). egg = { key, tier }.
export async function giftEggShow(egg) {
  if (!egg?.key || !CHARACTERS[egg.key]) return;
  if (egg.tier === 'mythic') { await mythicShow({ mythic: { key: egg.key, gift: true } }); return; }
  if (egg.tier === 'legendary') { await legendaryShow({ legendary: { key: egg.key, gift: true } }); return; }
  if (egg.tier === 'epic' || egg.tier === 'limited') { await epicShow({ key: egg.key, from: 'gift' }); return; }
  await new Promise(resolve => {
    momentOpen = true;
    eggRevealHtml(openOverlay('선생님 알'), egg.key, () => { closeOverlay(false); resolve(); });
  });
}
// V13.162 몬스터 사냥에서 잡은 펫: 알 상점과 같은 공개 연출(기본은 알 이름 카드, 영웅은 영웅 연출).
export async function huntPetShow(key, tier) {
  if (!key || !CHARACTERS[key]) return;
  if (tier === 'epic') { await epicShow({ key, from: 'hunt' }); return; }
  await new Promise(resolve => {
    momentOpen = true;
    const name = CHARACTERS[key].ko;
    eggRevealHtml(openOverlay('새 친구'), key, () => { closeOverlay(false); resolve(); }, `<b>${esc(petJosa(name, '이', '가'))}</b> 새 친구가 됐어요! 공 안에서 알로 쉬고 있어요`);
  });
}
async function eggShow(res, kind) {
  // V13.195 시리즈 알: 시리즈 전설은 전설 연출, 시리즈 영웅은 영웅 연출(시리즈 문구). 기본은 알 이름 카드(false).
  if (res.series) {
    if (res.rank === 'legendary') { await legendaryShow({ legendary: { key: res.key, series: true } }); return true; }
    if (res.rank === 'epic') { await epicShow({ key: res.key, from: 'series' }); return true; }
    return false;
  }
  if (res.mythic) { await mythicShow(res); return true; }
  if (res.legendary) { await legendaryShow(res); return true; }
  if (res.limited) { await epicShow({ key: res.key, from: kind === 'season' ? 'season' : 'shop' }); return true; }
  if (res.epic) { await epicShow({ key: res.key, from: 'shop' }); return true; }
  return false;
}
export function openEggShop(A, onChanged, kind = 'basic') {
  const g = A.data.stats;
  if (momentOpen || !g?.pet) return;
  momentOpen = true;
  const body = openOverlay('알 상점');
  // V13.98: closing is held while a purchase is on its way, so the coins spent always refresh the app.
  let buying = false;
  const close = changed => { if (!buying) closeOverlay(changed, onChanged); };
  const draw = () => {
    // V13.182: 전설 알 탭(맨 뒤). 다른 알의 흐름은 그대로 두고 이 탭만 따로 그린다(drawLegend).
    const le = A.data.legend_egg || null;
    // V13.195 곤충 · 공룡 시리즈 알 탭(전설 알 앞). 그림이 온 시리즈 펫이 없으면 탭이 없다.
    const se = A.data.series_egg?.ready ? A.data.series_egg : null;
    const eggs = { ...eggsNow(), ...(se ? { series: { name: '곤충 · 공룡 알', price: se.price } } : {}), ...(le ? { legend: { name: '전설 알', price: LEGEND_EGG_PRICE } } : {}) };
    if (!eggs[kind]) kind = 'basic';
    if (kind === 'legend') return drawLegend(eggs, le);
    if (kind === 'series') return drawSeries(eggs, se, le);
    const egg = eggs[kind], missing = egg.keys.filter(key => !g.pets.some(x => x.key === key));
    const hasLegend = g.pets.some(x => CHARACTERS[x.key]?.legendary);
    const short = Math.max(0, egg.price - Number(g.points_balance || 0));
    body.innerHTML = `<div class="pet-shop egg-shop-v1392 ${kind}">
      ${eggTabs(eggs, kind, le)}
      ${kind === 'season' ? `<div class="pet-shop-egg-art" aria-hidden="true">${uiArt('event-egg')}</div>` : kind === 'epic' && ART_READY.has('epic-egg') ? `<div class="pet-shop-egg-art" aria-hidden="true">${uiArt('epic-egg')}</div>` : `<div class="pet-shop-egg ${kind}" aria-hidden="true"><span>${kind === 'epic' ? '★' : '?'}</span></div>`}
      <p class="pet-moment-msg">${kind === 'season' ? '<b class="egg-shop-tier limited">한정</b> 어떤 친구가 들어 있을까요?' : kind === 'epic' ? '<b class="egg-shop-tier">영웅</b> 어떤 친구가 들어 있을까요?' : '어떤 친구가 들어 있을까요?'}</p>
      <p class="pet-shop-copy">${kind === 'season' ? `가을 이벤트 한정 펫(할로윈 · 수능 응원) ${missing.length}마리 중 한 마리의 알이 나와요.<br><b class="egg-shop-legend">${egg.until}까지만 팔아요!</b> 그 뒤에는 영웅 알에서만 가끔 나와요.` : kind === 'epic' ? `전설 바로 아래 등급, 영웅 펫 ${missing.length}마리 중 한 마리의 알이 나와요.<br>영웅 펫마다 새로운 야차전 특기가 있어요.${hasLegend ? '' : `<br><b class="egg-shop-legend">${EPIC_EGG_LEGENDARY_RATE}% 확률로 전설 펫이 나와요!</b>`}` : `아직 만나지 못한 기본 펫 ${missing.length}마리 중 한 마리의 알이 나와요.`}<br>새 알은 바로 파트너가 되고, 함께 공부하면 Lv.3에 태어나요.</p>
      <div class="pet-shop-price"><span>가격</span><b><i class="coin-ico" aria-hidden="true"></i>${num(egg.price)}</b><span>가진 코인</span><b><i class="coin-ico" aria-hidden="true"></i>${num(g.points_balance || 0)}</b></div>
      <p class="pet-name-error" role="alert">${!missing.length ? egg.all : short ? `코인이 ${num(short)}개 더 필요해요. 공부하면 코인이 쌓여요.` : ''}</p>
      <div class="pet-moment-actions"><button type="button" class="btn" data-pet-later>닫기</button><button type="button" class="btn primary" data-pet-buy ${!missing.length || short ? 'disabled' : ''}>${num(egg.price)}코인으로 ${egg.name} 사기</button></div>
      ${le ? legendFootHtml(le) : ''}
    </div>`;
    bindTabs();
    body.querySelector('[data-pet-later]').onclick = () => close(false);
    body.querySelector('[data-pet-buy]').onclick = async event => {
      const button = event.currentTarget; button.disabled = true;
      buying = true;
      try {
        const res = await api('/shop/egg', { kind });
        buying = false;
        // V13.98: a 영웅 알 can open as a legendary pet (1%), with the legendary show.
        if (res.mythic || res.legendary || res.epic || res.limited) { close(true); await eggShow(res, kind); return; }
        eggRevealHtml(body, res.key, () => close(true));
      } catch (err) {
        buying = false;
        body.querySelector('.pet-name-error').textContent = err.message;
        button.disabled = false;
      }
    };
  };
  const bindTabs = () => {
    body.querySelectorAll('[data-egg-kind]').forEach(b => { b.onclick = () => { if (buying) return; kind = b.dataset.eggKind; draw(); }; });
    body.querySelector('[data-legend-tab]')?.addEventListener('click', () => { if (buying) return; kind = 'legend'; draw(); });
  };
  // V13.195 곤충 · 공룡 시리즈 알: 아직 없는 시리즈 펫 하나(중복 없음), 다 모으면 안 판다. 등급 확률은 남은 펫으로 서버가 계산한다.
  const drawSeries = (eggs, se, le) => {
    const short = Math.max(0, se.price - Number(g.points_balance || 0));
    const odds = Object.entries(se.odds || {}).map(([rank, pct]) => `<span class="series-odd ${rank}"><b>${SERIES_RANKS[rank]}</b>${pct}%</span>`).join('');
    body.innerHTML = `<div class="pet-shop egg-shop-v1392 series">
      ${eggTabs(eggs, 'series', le)}
      <div class="pet-shop-egg-art series-egg-art" aria-hidden="true"><i class="series-egg-halo"></i>${uiArt(SERIES_EGG_ART)}</div>
      <p class="pet-moment-msg"><b class="egg-shop-tier series">곤충 · 공룡</b> ${se.done ? '시리즈 친구를 모두 모았어요!' : '곤충일까, 공룡일까?'}</p>
      <p class="pet-shop-copy">${se.done ? `곤충 ${num(se.bug.total)}마리 · 공룡 ${num(se.dino.total)}마리를 모두 만났어요.<br>더는 팔지 않아요. 도감에서 친구들을 만나 보세요!` : `곤충 · 공룡 친구 중 아직 만나지 못한 <b>${num(se.left)}마리</b>에서 한 마리의 알이 나와요.<br><b class="egg-shop-legend">이미 만난 친구는 다시 나오지 않아요!</b> 전설 공룡 렉스도 이 알에서만 만나요.`}</p>
      <div class="series-egg-meta">
        <div class="series-prog"><span class="bug">곤충 <b>${num(se.bug.owned)}</b>/${num(se.bug.total)}</span><span class="dino">공룡 <b>${num(se.dino.owned)}</b>/${num(se.dino.total)}</span></div>
        ${se.done ? '' : `<div class="series-odds" aria-label="이번 알의 등급 확률">${odds}</div>`}
      </div>
      ${se.done ? '' : `<div class="pet-shop-price"><span>가격</span><b><i class="coin-ico" aria-hidden="true"></i>${num(se.price)}</b><span>가진 코인</span><b><i class="coin-ico" aria-hidden="true"></i>${num(g.points_balance || 0)}</b></div>`}
      <p class="pet-name-error" role="alert">${!se.done && short ? `코인이 ${num(short)}개 더 필요해요. 공부하면 코인이 쌓여요.` : ''}</p>
      <div class="pet-moment-actions"><button type="button" class="btn" data-pet-later>닫기</button>${se.done ? '<span class="legend-egg-done">다 모았어요</span>' : `<button type="button" class="btn primary series-egg-btn" data-pet-buy ${short ? 'disabled' : ''}>${num(se.price)}코인으로 알 사기</button>`}</div>
      ${le ? legendFootHtml(le) : ''}
    </div>`;
    bindTabs();
    body.querySelector('[data-pet-later]').onclick = () => close(false);
    const buy = body.querySelector('[data-pet-buy]');
    if (buy) buy.onclick = async () => {
      buy.disabled = true; buying = true;
      try {
        const res = await api('/shop/egg', { kind: 'series' });
        buying = false;
        if (res.series_egg) A.data.series_egg = res.series_egg;
        if (res.rank !== 'basic') { close(true); await eggShow(res, 'series'); return; }
        eggRevealHtml(body, res.key, () => close(true));
      } catch (err) {
        buying = false;
        body.querySelector('.pet-name-error').textContent = err.message;
        buy.disabled = false;
      }
    };
  };
  // V13.182 전설 알: 받은 알이 있으면 열기, 없으면 15,000코인에 사기. V13.197: 못 만난 전설이 남은 만큼 여러 번 살 수 있다.
  const drawLegend = (eggs, le) => {
    const left = LEGENDARY_PET_KEYS.filter(key => !g.pets.some(x => x.key === key)).length;
    const short = Math.max(0, le.price - Number(g.points_balance || 0));
    const action = le.waiting ? '<button type="button" class="btn primary legend-egg-btn" data-legend-go>전설 알 열기</button>'
      : !left ? '<span class="legend-egg-done">전설 펫을 모두 만났어요</span>'
      : `<button type="button" class="btn primary legend-egg-btn" data-legend-go ${short ? 'disabled' : ''}>${num(le.price)}코인으로 전설 알 사기</button>`;
    body.innerHTML = `<div class="pet-shop egg-shop-v1392 legend">
      ${eggTabs(eggs, 'legend', le)}
      <div class="pet-shop-egg-art legend-egg-art" aria-hidden="true"><i class="legend-egg-halo"></i><img src="/assets/lucky/legend-egg.webp" alt="" width="132" height="132" decoding="async"></div>
      <p class="pet-moment-msg"><b class="egg-shop-tier legend">전설</b> ${le.waiting ? '전설 알이 기다리고 있어요!' : '어떤 전설이 깨어날까요?'}</p>
      <p class="pet-shop-copy">${!left ? '전설 펫을 모두 만났어요!<br>영웅을 모으면 전설 알 대신 코인과 칭호를 받아요.' : `아직 만나지 못한 전설 펫 ${left}마리 중 한 마리가 랜덤으로 깨어나요.<br><b class="egg-shop-legend">전설은 여러 마리 함께할 수 있어요! 같은 전설은 다시 안 나와요.</b>`}</p>
      ${le.waiting || !left ? '' : `<div class="pet-shop-price"><span>가격</span><b><i class="coin-ico" aria-hidden="true"></i>${num(le.price)}</b><span>가진 코인</span><b><i class="coin-ico" aria-hidden="true"></i>${num(g.points_balance || 0)}</b></div>`}
      <p class="pet-name-error" role="alert">${!le.waiting && left && short ? `코인이 ${num(short)}개 더 필요해요.` : ''}</p>
      <div class="pet-moment-actions"><button type="button" class="btn" data-pet-later>닫기</button>${action}</div>
      ${legendFootHtml(le)}
    </div>`;
    bindTabs();
    body.querySelector('[data-pet-later]').onclick = () => close(false);
    const go = body.querySelector('[data-legend-go]');
    if (go) go.onclick = async () => {
      go.disabled = true; buying = true;
      try {
        const res = await api(le.waiting ? '/legend-egg/open' : '/legend-egg/buy', {});
        buying = false;
        close(true);
        await legendEggResultShow(res);
      } catch (err) {
        buying = false;
        body.querySelector('.pet-name-error').textContent = err.message;
        go.disabled = false;
      }
    };
  };
  $('[data-pet-close]').onclick = () => close(false);
  draw();
}

/* ---------- V13.182 전설 알 ---------- */
// 알 상점 탭(전설 알은 받은 알이 있으면 '열기!').
function eggTabs(eggs, kind, le) {
  return `<div class="egg-shop-tabs" role="tablist">${Object.entries(eggs).map(([k, e]) => `<button type="button" role="tab" data-egg-kind="${k}" aria-selected="${k === kind}" class="${k === kind ? 'selected' : ''} ${k}">${k === 'epic' ? '<i aria-hidden="true">★</i>' : k === 'season' ? '<i aria-hidden="true">🎃</i>' : k === 'series' ? '<i aria-hidden="true">🦕</i>' : k === 'legend' ? '<i aria-hidden="true">♛</i>' : ''}${e.name}<small>${k === 'legend' && le?.waiting ? '열기!' : `${num(e.price)}코인`}</small></button>`).join('')}</div>`;
}
// 상점 하단: 영웅 진행과 선생님 문구.
function legendFootHtml(le) {
  const n = Math.min(le.epic, le.need);
  return `<div class="legend-egg-foot${le.got ? ' got' : ''}">
    <button type="button" class="legend-egg-progress" data-legend-tab aria-label="전설 알 보기"><span>영웅 ${num(le.epic)} / ${num(le.need)}마리${le.got ? ' · 전설 알 보상 받음' : ''}</span><i style="--p:${Math.round(n / le.need * 100)}%"></i></button>
    <p>너무 비싸면 영웅 20명 모으면 줍니다^^</p>
  </div>`;
}
// 전설 알을 연 결과: 전설 펫이면 전설 연출(전설 알 판), 전설을 다 만났으면 코인 안내.
async function legendEggResultShow(res) {
  if (res?.legendary?.key) { await legendaryShow({ legendary: { key: res.legendary.key, legendEgg: res.legendary.legend_egg || 'epic' } }); return; }
  if (res?.coins) await legendNotice('coins', { coins: res.coins });
}
const LEGEND_SEEN = id => `sumus:v13:legend-egg:${id}`;
const readLegendSeen = id => { try { return localStorage.getItem(LEGEND_SEEN(id)); } catch { return null; } };
const writeLegendSeen = (id, mark) => { try { localStorage.setItem(LEGEND_SEEN(id), mark); } catch {} };
// 받았다는 안내(전설 알 도착 · 대신 받은 코인과 칭호). 'open'을 고르면 true.
function legendNotice(kind, { coins = 0, epic = LEGEND_EGG_EPIC_NEED } = {}) {
  return new Promise(resolve => {
    momentOpen = true;
    const body = openOverlay(kind === 'egg' ? '전설 알 도착' : '전설 알 보상');
    const egg = kind === 'egg';
    body.innerHTML = `<div class="legend-gift ${kind}">
      <span class="legend-gift-kicker">영웅 ${num(epic)}마리 달성!</span>
      <div class="legend-gift-stage" aria-hidden="true"><i class="legend-gift-rays"></i><i class="legend-gift-ring"></i>${egg ? '<img src="/assets/lucky/legend-egg.webp" alt="" width="150" height="150">' : '<b class="legend-gift-coin"><i class="coin-ico"></i></b>'}<div class="pet-bits"></div></div>
      <h2>${egg ? '전설 알을 받았어요!' : `${num(coins)}코인을 받았어요!`}</h2>
      <p>${egg ? '알을 열면 아직 만나지 못한 전설 펫 중 한 마리가 깨어나요.<br>나중에 열려면 알 상점 → 전설 알' : "전설 펫을 이미 만나서 전설 알 대신 코인과 칭호 <b>'전설의 주인'</b>을 받았어요."}</p>
      <div class="pet-moment-actions">${egg ? '<button type="button" class="btn" data-legend-later>나중에 열기</button><button type="button" class="btn primary legend-egg-btn" data-legend-open>지금 열기</button>' : '<button type="button" class="btn primary" data-legend-later>좋아요!</button>'}</div>
    </div>`;
    const done = open => { closeOverlay(false); resolve(open); };
    body.querySelector('[data-legend-later]').onclick = () => done(false);
    body.querySelector('[data-legend-open]')?.addEventListener('click', () => done(true));
    $('[data-pet-close]').onclick = () => done(false);
    if (!reducedMotion()) burst(body.querySelector('.pet-bits'), 28, false);
    playSound(egg ? 'fanfare-legend' : 'fanfare-epic');
    setTimeout(() => body.querySelector('.legend-egg-btn, [data-legend-later]')?.focus({ preventScroll: true }), 60);
  });
}
// 홈 화면에서(펫 연출 뒤): 받을 차례면 한 번 받고(/legend-egg/claim, 배포 전에 이미 모은 학생도), 받은 것을 기기마다 한 번 알린다.
let legendClaiming = false, legendRetry = 0;
export async function maybeLegendEggMoment(A, onChanged, tries = 0) {
  const p = A.data?.profile, v = A.data?.legend_egg;
  if (!v || legendClaiming || A.screen || A.tab !== 'home' || p?.role !== 'student' || !A.data?.stats?.pet) return;
  // 다른 창(펫 · 칭호 연출)이 떠 있으면 닫힐 때까지 잠깐씩 기다린다.
  if (momentOpen || $('#modal-root').children.length) {
    clearTimeout(legendRetry);
    if (tries < 30 && (v.due || v.waiting || v.reward)) legendRetry = setTimeout(() => maybeLegendEggMoment(A, onChanged, tries + 1), 2000);
    return;
  }
  let changed = false;
  if (v.due) {
    legendClaiming = true;
    try { const res = await api('/legend-egg/claim', {}); A.data.legend_egg = res.legend_egg; changed = !!res.given; }
    catch { return; }
    finally { legendClaiming = false; }
    if (momentOpen || $('#modal-root').children.length) { if (changed) onChanged?.(); return; }
  }
  const now = A.data.legend_egg;
  const mark = now.waiting ? `egg@${now.got}` : now.reward ? `coins@${now.reward.at}` : null;
  if (!mark || readLegendSeen(p.id) === mark) { if (changed) onChanged?.(); return; }
  writeLegendSeen(p.id, mark);
  const open = await legendNotice(now.waiting ? 'egg' : 'coins', { coins: now.reward?.coins, epic: now.epic });
  if (!open) { if (changed || now.reward) onChanged?.(); return; }
  try { const res = await api('/legend-egg/open', {}); onChanged?.(); await legendEggResultShow(res); }
  catch (err) { toast(err.message); onChanged?.(); }
}
