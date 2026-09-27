import { $, api, esc, toast } from './ui.js';
import { CHARACTERS, PET_FORMS, PET_NAME_MAX, cleanPetName } from './core.js';
import { avatar, petKey } from './character.js';

// Pet moments: the hatch (egg -> baby) and evolution scenes shown on the home screen the
// first time a student's pet reaches a new form, plus the pet-name form.
// The last form a student has seen is kept per device, so each moment plays once.

const SEEN_KEY = id => `sumus:v13:pet-form:${id}`;
const readSeen = id => { try { const v = localStorage.getItem(SEEN_KEY(id)); return v === null ? null : Number(v); } catch { return null; } };
const writeSeen = (id, form) => { try { localStorage.setItem(SEEN_KEY(id), String(form)); } catch {} };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const petJosa = (word, withBatchim, without) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? withBatchim : without);
};
export const petDisplayName = profile => profile.pet_name || CHARACTERS[petKey(profile.avatar_key)].ko;

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

function nameFormHtml(profile) {
  const fallback = CHARACTERS[petKey(profile.avatar_key)].ko;
  return `<form class="pet-name-form" novalidate>
    <label for="pet-name-input">우리 펫의 이름을 지어주세요</label>
    <input id="pet-name-input" name="pet_name" autocomplete="off" enterkeyhint="done" maxlength="24" placeholder="${esc(fallback)}" value="${esc(profile.pet_name || '')}">
    <p class="pet-name-hint">한글·영어·숫자 ${PET_NAME_MAX}자까지 · 비워 두면 '${esc(fallback)}'(으)로 불러요</p>
    <p class="pet-name-error" role="alert"></p>
    <div class="pet-moment-actions"><button type="button" class="btn" data-pet-later>나중에</button><button type="submit" class="btn primary">이 이름으로 할게요</button></div>
  </form>`;
}

function bindNameForm(root, profile, done) {
  const form = root.querySelector('.pet-name-form'), input = form.querySelector('input'), error = form.querySelector('.pet-name-error');
  form.querySelector('[data-pet-later]').onclick = () => done(false);
  form.onsubmit = async event => {
    event.preventDefault();
    const { name, error: problem } = cleanPetName(input.value);
    if (problem) { error.textContent = problem; input.focus(); return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; error.textContent = '';
    try {
      await api('/profile/pet-name', { pet_name: name });
      profile.pet_name = name || undefined;
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
  const p = A.data?.profile;
  if (momentOpen || A.screen || A.tab !== 'home' || p?.role !== 'student' || !p.avatar_key || $('#modal-root').children.length) return;
  const form = Number(A.data.stats?.form ?? 0), level = Number(A.data.stats?.level || 1);
  let seen = readSeen(p.id);
  if (seen === null) {
    // First run of this version: pets that were still eggs under the old Lv.5 rule get their hatch.
    seen = form >= 1 && level < 5 ? 0 : form;
    writeSeen(p.id, seen);
  }
  if (form <= seen) { if (form < seen) writeSeen(p.id, form); return; }
  momentOpen = true;
  const key = petKey(p.avatar_key);
  const body = openOverlay(seen === 0 ? '부화' : '진화');
  let named = false;
  $('[data-pet-close]').onclick = () => { writeSeen(p.id, form); closeOverlay(named, onChanged); };
  const finished = () => {
    writeSeen(p.id, form);
    const next = document.createElement('div');
    next.className = 'pet-moment-next';
    if (seen === 0 && !p.pet_name) {
      next.innerHTML = nameFormHtml(p);
      body.appendChild(next);
      bindNameForm(next, p, saved => { named = saved; closeOverlay(saved, onChanged); });
    } else {
      next.innerHTML = '<div class="pet-moment-actions"><button type="button" class="btn primary" data-pet-done>좋아요!</button></div>';
      body.appendChild(next);
      next.querySelector('[data-pet-done]').onclick = () => closeOverlay(false, onChanged);
      next.querySelector('[data-pet-done]').focus({ preventScroll: true });
    }
  };
  if (seen === 0) hatchScene(body, key, petDisplayName(p), finished);
  else evolveScene(body, key, petDisplayName(p), Math.max(1, seen), form, finished);
}

// Rename from the home or studio screen.
export function openPetNameModal(A, onChanged) {
  const p = A.data.profile;
  if (momentOpen || !p.avatar_key) return;
  momentOpen = true;
  const body = openOverlay('펫 이름 짓기');
  body.innerHTML = `<div class="pet-name-solo"><div class="pet-name-avatar">${avatar(p.avatar_key, { form: Math.max(1, Number(A.data.stats?.form ?? 1)), expression: 'happy' })}</div>${nameFormHtml(p)}</div>`;
  $('[data-pet-close]').onclick = () => closeOverlay(false, onChanged);
  bindNameForm(body, p, saved => closeOverlay(saved, onChanged));
}
