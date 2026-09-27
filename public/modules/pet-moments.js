import { $, api, esc, num, toast } from './ui.js';
import { CHARACTERS, PET_FORMS, PET_NAME_MAX, EGG_PRICE, cleanPetName } from './core.js';
import { avatar, petKey } from './character.js';

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
    if (taps < HATCH_TAPS) { msg.textContent = taps === 1 ? '앗, 금이 갔어요!' : '조금만 더! 한 번만 더 두드려요'; return; }
    busy = true; clearTimeout(autoTimer);
    msg.textContent = '알이 빛나기 시작했어요…';
    scene.dataset.state = 'charging';
    setTimeout(() => {
      const flash = body.querySelector('.pet-flash'); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      burst(body.querySelector('.pet-bits'), 24, true);
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
    scene.dataset.state = 'done';
    msg.innerHTML = `<b>${esc(petJosa(name, '이', '가'))}</b> ${PET_FORMS[to]} 모습으로 진화했어요!`;
    onEvolved();
  };
  body.querySelector('[data-pet-evolve]').onclick = () => {
    body.querySelector('.pet-moment-actions').remove();
    if (reducedMotion()) return finish();
    scene.dataset.state = 'charging';
    setTimeout(() => {
      scene.dataset.state = 'flicker';
      msg.textContent = `${petJosa(name, '이', '가')} 진화하고 있어요!`;
      let t = 0;
      EVO_FLICKER.forEach((gap, i) => { t += gap; setTimeout(() => stage.classList.toggle('show-to', i % 2 === 0), t); });
      setTimeout(finish, t + 350);
    }, EVO_CHARGE_MS);
  };
}

function closeOverlay(changed, onChanged) {
  $('#modal-root').innerHTML = '';
  momentOpen = false;
  if (changed) onChanged?.();
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
export function openEggShop(A, onChanged) {
  const g = A.data.stats;
  if (momentOpen || !g?.pet) return;
  const missing = Object.keys(CHARACTERS).filter(key => !g.pets.some(x => x.key === key));
  const short = Math.max(0, EGG_PRICE - Number(g.points_balance || 0));
  momentOpen = true;
  const body = openOverlay('랜덤 알 상점');
  body.innerHTML = `<div class="pet-shop">
    <div class="pet-shop-egg" aria-hidden="true"><span>?</span></div>
    <p class="pet-moment-msg">어떤 친구가 들어 있을까요?</p>
    <p class="pet-shop-copy">아직 만나지 못한 ${missing.length}마리 중 한 마리의 알이 나와요.<br>새 알은 바로 파트너가 되고, 함께 공부하면 Lv.3에 태어나요.</p>
    <div class="pet-shop-price"><span>가격</span><b>${num(EGG_PRICE)}P</b><span>보유</span><b>${num(g.points_balance || 0)}P</b></div>
    <p class="pet-name-error" role="alert">${!missing.length ? '모든 펫을 모았어요!' : short ? `${num(short)}P가 더 필요해요. 공부하면 포인트가 쌓여요.` : ''}</p>
    <div class="pet-moment-actions"><button type="button" class="btn" data-pet-later>닫기</button><button type="button" class="btn primary" data-pet-buy ${!missing.length || short ? 'disabled' : ''}>${num(EGG_PRICE)}P로 알 사기</button></div>
  </div>`;
  const close = changed => closeOverlay(changed, onChanged);
  $('[data-pet-close]').onclick = () => close(false);
  body.querySelector('[data-pet-later]').onclick = () => close(false);
  body.querySelector('[data-pet-buy]').onclick = async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      const { key } = await api('/shop/egg', {});
      const name = CHARACTERS[key].ko;
      body.innerHTML = `<div class="pet-shop">
        <div class="pet-shop-reveal">${avatar(key, { form: 0 })}</div>
        <p class="pet-moment-msg"><b>${esc(petJosa(name, '이', ''))}</b>의 알이에요!</p>
        <p class="pet-shop-copy">지금부터 ${esc(petJosa(name, '과', '와'))} 함께 공부해요.<br>Lv.3이 되면 알이 깨져요.</p>
        <div class="pet-moment-actions"><button type="button" class="btn primary" data-pet-done>좋아요!</button></div>
      </div>`;
      body.querySelector('[data-pet-done]').onclick = () => close(true);
      $('[data-pet-close]').onclick = () => close(true);
    } catch (err) {
      body.querySelector('.pet-name-error').textContent = err.message;
      button.disabled = false;
    }
  };
}
