import { esc } from './ui.js';
import { avatar } from './character.js';
import { openSheet } from './sheet.js';

// V13.131 friend list, one for the 야차전 challenge and the 던전 invite: a bottom sheet with
// 우리 반 · 우리 학교 · 다른 학교 tabs. A row is a 44px round pet face, the name on one line
// (… when long), a small button, and gray text instead of the button while the friend is busy.
// The pet face sits in a fixed box, so it never stretches however the row is laid out.
const GROUPS = [['class', '우리 반'], ['school', '우리 학교'], ['other', '다른 학교']];
export const friendGroup = (f, mySchool) => f.same_class ? 'class' : mySchool && f.school === mySchool ? 'school' : 'other';

// art: drawn icon html for the header · title/sub: header lines · status(f): gray text when the
// friend cannot be picked now · onPick(f, ui): ui.sent() marks the row, ui.reset() frees the
// button again, ui.close() closes the sheet.
export function openFriendSheet({ art = '', title, sub = '', friends, mySchool = '', goLabel, doneLabel = '보냈어요', status = () => '', where = f => [f.school, f.class_name].filter(Boolean).join(' · '), onPick, empty = '같은 학년 친구가 아직 없어요.' }) {
  const group = f => friendGroup(f, mySchool), count = key => friends.filter(f => group(f) === key).length;
  let tab = (GROUPS.find(([key]) => count(key)) || GROUPS[0])[0];
  const sent = new Set();
  const row = f => {
    const text = status(f), done = sent.has(f.id);
    return `<div class="fl-row" role="listitem"><span class="fl-pet">${f.pet ? avatar(f.pet.key, { form: f.pet.form, size: 'mini' }) : ''}</span><div class="fl-who"><b>${esc(f.name)}</b><span>${esc(where(f))}</span></div>${text ? `<span class="fl-status">${esc(text)}</span>` : `<button type="button" class="fl-go${done ? ' sent' : ''}" data-fl-go="${esc(f.id)}"${done ? ' disabled' : ''}>${done ? esc(doneLabel) : esc(goLabel)}</button>`}</div>`;
  };
  const draw = () => {
    const rows = friends.filter(f => group(f) === tab);
    return `<div class="fl-head">${art ? `<span class="fl-art" aria-hidden="true">${art}</span>` : ''}<div><h2>${esc(title)}</h2>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>
      ${friends.length ? `<div class="ya-seg" role="group" aria-label="친구 묶음">${GROUPS.map(([key, label]) => `<button type="button" data-fl-tab="${key}" class="${tab === key ? 'on' : ''}" aria-pressed="${tab === key}">${label} <i>${count(key)}</i></button>`).join('')}</div>
        <div class="fl-list" role="list">${rows.length ? rows.map(row).join('') : '<p class="fl-empty">이 묶음에는 친구가 아직 없어요.</p>'}</div>
        <p class="fl-note">펫을 고른 같은 학년 친구만 보여요.</p>` : `<p class="fl-empty">${esc(empty)}</p>`}`;
  };
  const sheet = openSheet(draw(), title, { className: 'fl-sheet' });
  sheet.box.addEventListener('click', async event => {
    const tabButton = event.target.closest('[data-fl-tab]');
    if (tabButton) { tab = tabButton.dataset.flTab; sheet.set(draw()); sheet.box.querySelector(`[data-fl-tab="${tab}"]`)?.focus(); return; }
    const go = event.target.closest('[data-fl-go]');
    if (!go || go.disabled) return;
    const friend = friends.find(f => f.id === go.dataset.flGo);
    if (!friend) return;
    go.disabled = true; go.classList.add('busy');
    await onPick(friend, {
      sent: () => { sent.add(friend.id); sheet.set(draw()); },
      reset: () => { go.disabled = false; go.classList.remove('busy'); },
      close: sheet.close
    });
  });
  return sheet;
}
