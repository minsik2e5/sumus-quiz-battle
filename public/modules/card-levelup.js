// V13.78 레벨업 연출 (홈 파트너 카드).
// - 같은 등급 안에서 레벨이 오르면: 카드가 톡 튀고 빛이 한 번 지나가며 "Lv.8!"
// - 등급이 바뀌면(예: R → RR): 화면이 어두워지고 카드가 뒤집히며 새 테두리로 바뀌고, 등급
//   도장이 찍혀요. 다음 등급까지 몇 레벨 남았는지도 보여줘요.
// 마지막으로 본 레벨은 이 기기에 펫마다 저장해요(처음 보는 기기는 연출 없이 지금 레벨부터).
import { cardTier, MAX_LEVEL, petForm, PET_FORMS } from './core.js';
import { esc } from './ui.js';

const key = (profileId, petKey) => `sumus:card-level:${profileId}:${petKey}`;
const read = k => { try { return Number(localStorage.getItem(k)) || 0; } catch { return -1; } };
// Also kept in memory, so a full storage never replays the same moment on every redraw.
const shown = new Map();
const write = (k, v) => { shown.set(k, v); try { localStorage.setItem(k, String(v)); } catch {} };
let open = false, waiting = false;

export function maybeCardLevelUp(A) {
  const p = A.data?.profile, g = A.data?.stats;
  // Same fallback as the home card (accounts from before pets were collectible have no stats.pet).
  const pet = g?.pet || (p?.avatar_key ? { key: p.avatar_key, level: Number(g?.level || 1), name: '' } : null);
  if (open || A.screen || A.tab !== 'home' || p?.role !== 'student' || !pet?.key) return;
  // An evolution or another moment is on screen: try again when it closes.
  const root = document.querySelector('#modal-root');
  if (root?.children.length) { waitForClear(root, () => maybeCardLevelUp(A)); return; }
  const level = Math.min(MAX_LEVEL, Number(pet.level || 1)), k = key(p.id, pet.key), seen = Math.max(read(k), shown.get(k) || 0);
  if (seen < 0) return;
  if (!seen || level <= seen) { if (level !== seen) write(k, level); return; }
  write(k, level);
  const from = cardTier(seen), to = cardTier(level);
  if (to.index > from.index) upgradeScene(seen, level, from, to, pet);
  // The home screen redraws once right after opening (알림 check); play after that.
  else setTimeout(() => bump(level), 900);
}

function waitForClear(root, again) {
  if (waiting) return;
  waiting = true;
  const observer = new MutationObserver(() => {
    if (root.children.length) return;
    observer.disconnect();
    waiting = false;
    setTimeout(again, 350);
  });
  observer.observe(root, { childList: true });
}

function bump(level) {
  const section = document.querySelector('#app .partner-card-v1358');
  if (!section) return;
  section.classList.remove('lv-bump'); void section.offsetWidth; section.classList.add('lv-bump');
  const tag = document.createElement('span');
  tag.className = 'lv-float'; tag.textContent = `Lv.${level}!`; tag.setAttribute('role', 'status');
  section.querySelector('.partner-card')?.appendChild(tag);
  navigator.vibrate?.([14, 30, 14]);
  setTimeout(() => { tag.remove(); section.classList.remove('lv-bump'); }, 2000);
}

// The card as it was (old tier, old level) and as it is now.
function cardAt(section, tier, level) {
  const clone = section.cloneNode(true);
  clone.className = clone.className.replace(/\btier-[a-z]+\b/g, '').replace(/\s+/g, ' ').trim() + ` tier-${tier.key}${tier.max ? ' tier-max' : ''}`;
  clone.classList.remove('flipped', 'lv-bump', 'missed-v1376');
  clone.querySelector('.card-fx')?.remove();
  const rarity = clone.querySelector('.card-rarity');
  if (rarity) { rarity.className = `card-rarity rarity-${tier.key}`; rarity.textContent = tier.label; }
  const lv = clone.querySelector('.partner-lv b');
  if (lv) lv.textContent = level;
  // At Lv.3, 10 and 20 the pet evolved too: the card before shows the earlier form.
  const form = petForm(level), img = clone.querySelector('.partner-art .avatar-art img');
  if (img && /-\d(?:-[a-z]+)?\.webp$/.test(img.getAttribute('src') || '')) {
    img.setAttribute('src', img.getAttribute('src').replace(/-(\d)((?:-[a-z]+)?)\.webp$/, `-${form}.webp`));
    const art = clone.querySelector('.partner-art .avatar-art');
    art.className = art.className.replace(/avatar-form-\d/, `avatar-form-${form}`);
    const stage = clone.querySelector('.partner-stage');
    if (stage) stage.textContent = PET_FORMS[form];
  }
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  clone.querySelector('.partner-card-btn')?.setAttribute('tabindex', '-1');
  return clone;
}

function upgradeScene(fromLevel, level, from, to, pet) {
  const section = document.querySelector('#app .partner-card-v1358');
  if (!section) return;
  open = true;
  const oldCard = cardAt(section, from, fromLevel);
  const newCard = section.cloneNode(true);
  newCard.classList.remove('flipped', 'lv-bump');
  newCard.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  newCard.querySelector('.partner-card-btn')?.setAttribute('tabindex', '-1');
  const next = to.next, span = next ? next.min - to.min : 1, done = next ? level - to.min : span;
  const box = document.createElement('div');
  box.className = 'card-up-v1378';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1; box.setAttribute('aria-label', `카드 등급 업: ${to.label} ${to.name}`);
  box.innerHTML = `<div class="up-rays" aria-hidden="true"></div>
    <div class="up-stage">
      <p class="up-title">✦ 카드 등급 업 ✦</p>
      <div class="up-card"></div>
      <div class="up-text" hidden><b>${esc(to.label)} ${esc(to.name)} 달성!</b><small>Lv.${level} · ${esc(pet.name || '')}${pet.name ? '의 ' : ''}카드가 한 단계 빛나요</small></div>
      <div class="up-next" hidden>${next ? `다음 <b>${esc(next.label)} ${esc(next.name)}</b>까지 ${next.min - level}레벨<i style="--p:${Math.round(done / span * 100)}%"></i>` : `Lv.${MAX_LEVEL} MAX · 최고 등급이에요!`}</div>
      <button type="button" class="up-ok">좋아요!</button>
    </div>`;
  document.querySelector('#modal-root').appendChild(box);
  box.focus({ preventScroll: true });
  const holder = box.querySelector('.up-card');
  holder.appendChild(oldCard);
  const close = () => { box.remove(); open = false; };
  box.querySelector('.up-ok').onclick = close;
  box.onkeydown = e => { if (e.key === 'Escape') close(); };
  const later = (ms, fn) => setTimeout(() => { if (box.isConnected) fn(); }, ms);
  later(900, () => holder.classList.add('flipping'));
  later(1350, () => { holder.replaceChildren(newCard); });
  later(1800, () => {
    holder.classList.remove('flipping');
    const stamp = document.createElement('div');
    stamp.className = 'up-stampbox';
    stamp.innerHTML = `<span class="up-stamp">${esc(to.label)}</span>`;
    holder.appendChild(stamp);
    const colors = ['#ffd76a', '#ff8fc0', '#7fe3c7', '#8cc8ff', '#c9a2ff', '#fff'];
    for (let i = 0; i < 22; i++) {
      const dot = document.createElement('i');
      const a = i / 22 * Math.PI * 2, r = 110 + (i % 5) * 26;
      dot.className = 'up-burst';
      dot.style.cssText = `--c:${colors[i % colors.length]};--bx:${Math.round(Math.cos(a) * r)}px;--by:${Math.round(Math.sin(a) * r)}px`;
      box.appendChild(dot);
      setTimeout(() => dot.remove(), 1000);
    }
    navigator.vibrate?.([20, 40, 60]);
  });
  later(2300, () => {
    box.querySelector('.up-text').hidden = false;
    box.querySelector('.up-next').hidden = false;
    const ok = box.querySelector('.up-ok');
    ok.classList.add('show'); ok.focus({ preventScroll: true });
  });
}
