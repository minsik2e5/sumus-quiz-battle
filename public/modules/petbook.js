import { CHARACTERS, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, LIMITED_PET_KEYS, SEASONS, seasonOnSale, PET_FORMS, PET_FORM_LEVELS, EGG_PRICE, EPIC_EGG_PRICE, EPIC_EGG_LEGENDARY_RATE } from './core.js';
import { icon, esc, num } from './ui.js';
import { PET_SKILLS } from './battle-engine.js';
import { petDisplayName } from './pet-moments.js';
import { LEGENDARY_RATE, LEGENDARY_PITY, EPIC_RATE } from './rewards.js';

// V13.91 펫 도감: every pet of the game under 나. A pet the student has met shows its forms
// (the forms it has reached in colour, the next ones as shadows); a pet not met yet is a shadow
// with how to meet it. Legendary pets have no yacha skill.
const sprite = (key, form, shadow) => `<img class="pb-sprite${shadow ? ' shadow' : ''}" src="/assets/pets/${key}-${form}-s.webp" alt="" width="160" height="160" loading="lazy" decoding="async" draggable="false">`;

// V13.112 `teacher`: { owners: [names], partners: n } shows the pet to a teacher (every form in colour,
// how it is met, and which students have it) instead of a student's own collection.
function card(key, no, pet, teacher = null) {
  const c = CHARACTERS[key], legend = !!c.legendary, epic = !!c.epic, season = c.limited ? SEASONS[c.limited] : null, skill = PET_SKILLS[key];
  const met = !!pet, form = met ? pet.form : -1;
  const forms = PET_FORMS.map((label, f) => {
    const seen = met && f <= form;
    return `<figure class="pb-form ${seen ? 'seen' : ''}">${sprite(key, f, !seen)}<figcaption>${seen ? label : f ? `Lv.${PET_FORM_LEVELS[f]}` : '알'}</figcaption></figure>`;
  }).join('');
  // V13.109 한정 펫: its season's egg while on sale, then only 영웅 eggs.
  const how = season ? (seasonOnSale()?.id === c.limited ? `${season.egg} ${num(season.price)}코인 · ${season.until}까지 판매` : `${season.name} 한정 · 지금은 영웅 알 · 코인 뽑기 영웅 알에서 ${season.after_rate}%`) : legend ? `코인 뽑기 ${LEGENDARY_RATE}% · 영웅 알 ${EPIC_EGG_LEGENDARY_RATE}% · 뽑기 ${num(LEGENDARY_PITY)}번 안에 확정` : epic ? `영웅 알 ${num(EPIC_EGG_PRICE)}코인 · 코인 뽑기 ${EPIC_RATE}%` : `상점의 랜덤 알 · ${num(EGG_PRICE)}코인`;
  const foot = met
    ? skill ? `<span class="pb-skill">야차전 특기</span><b>${esc(skill.name)}</b><small>${esc(skill.desc)}</small>` : season ? `<span class="pb-skill limited">${esc(season.name)} 한정</span><small>특기 대신 ${esc(season.name)}에만 만날 수 ${seasonOnSale()?.id === c.limited ? '있는' : '있었던'} 모습을 가졌어요</small>` : `<span class="pb-skill gold">전설 펫</span><small>특기 대신 전설의 빛을 두르고 있어요</small>`
    : `<span class="pb-skill lock">${icon('lock')}만나는 법</span><small>${how}</small>`;
  const name = met ? `<b>${esc(c.ko)}</b>${pet.name ? `<em>${esc(petDisplayName(pet))}</em>` : ''}` : '<b>???</b>';
  return `<article class="pb-card ${legend ? 'legend' : ''}${epic ? 'epic' : ''}${season ? 'limited' : ''} ${met ? 'met' : 'unmet'}" style="--pc:${c.color};--pl:${c.light};--ps:${c.soft}" aria-label="${met ? esc(c.ko) : '아직 못 만난 펫'}">
    <header><span class="pb-no">No.${String(no).padStart(2, '0')}</span>${name}<span class="pb-type">${met || legend || epic || season ? esc(c.type) : '?'}</span>${season ? `<span class="pb-limited">🎃 ${esc(season.name)} 한정</span>` : legend ? '<span class="pb-legend">★ 전설</span>' : epic ? '<span class="pb-epic">★ 영웅</span>' : ''}</header>
    <div class="pb-forms">${forms}</div>
    <footer>${foot}${teacher ? `<span class="pb-lv pb-owners${teacher.owners.length ? '' : ' none'}">보유 ${num(teacher.owners.length)}명</span>` : met ? `<span class="pb-lv">Lv.${num(pet.level || 1)}</span>` : ''}</footer>
    ${teacher ? `<div class="pb-teacher"><p><b>얻는 법</b>${how}</p><p class="pb-owner-names"><b>보유 학생</b>${teacher.owners.length ? `${teacher.owners.slice(0, 8).map(n => `<span>${esc(n)}</span>`).join('')}${teacher.owners.length > 8 ? `<em>외 ${num(teacher.owners.length - 8)}명</em>` : ''}${teacher.partners ? `<em class="partner">파트너 ${num(teacher.partners)}명</em>` : ''}` : '<em>아직 없어요</em>'}</p></div>` : ''}
  </article>`;
}

export function petBookPage(A) {
  const owned = A.data.stats?.pets || [], mine = key => owned.find(pet => pet.key === key);
  const all = [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS, ...LEGENDARY_PET_KEYS, ...LIMITED_PET_KEYS], met = all.filter(mine).length;
  const metOf = keys => keys.filter(mine).length;
  const pct = Math.round(met / all.length * 100);
  return `<button type="button" class="page-back-v1368" data-go="me">${icon('back')}나</button>
    <div class="page-heading pb-head"><span class="premium-eyebrow">PET DEX</span><h1>펫 도감</h1><p>만난 펫은 자란 모습까지, 아직 못 만난 펫은 그림자로 보여요.</p></div>
    <section class="pb-progress" aria-label="도감 진행">
      <div><b>${num(met)}</b><span>/ ${num(all.length)} 마리 만났어요</span></div>
      <i style="--p:${pct}%" aria-hidden="true"></i>
      <small>기본 펫 ${num(metOf(STANDARD_PET_KEYS))}/${num(STANDARD_PET_KEYS.length)} · 영웅 펫 ${num(metOf(EPIC_PET_KEYS))}/${num(EPIC_PET_KEYS.length)} · 전설 펫 ${num(metOf(LEGENDARY_PET_KEYS))}/${num(LEGENDARY_PET_KEYS.length)} · 한정 펫 ${num(metOf(LIMITED_PET_KEYS))}/${num(LIMITED_PET_KEYS.length)}</small>
    </section>
    <h2 class="pb-section">기본 펫</h2>
    <div class="pb-grid">${STANDARD_PET_KEYS.map((key, i) => card(key, i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section epic">영웅 펫 <small>전설 바로 아래</small></h2>
    <div class="pb-grid">${EPIC_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section legend">전설 펫</h2>
    <div class="pb-grid">${LEGENDARY_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length + i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section limited">한정 펫 <small>시즌에만 파는 알</small></h2>
    <div class="pb-grid">${LIMITED_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length + LEGENDARY_PET_KEYS.length + i + 1, mine(key))).join('')}</div>`;
}

// V13.112 선생님 화면의 펫 도감: all pets with every form, the yacha skill, how a student meets it and
// which students of the school have it (the student's own dex is petBookPage).
export function teacherPetDex(A) {
  const students = (A.data.profiles || []).filter(p => p.active !== false && !p.preview_owner_id && p.role !== 'teacher');
  const ownersOf = key => ({
    owners: students.filter(p => (p.pets || []).some(pet => pet.key === key)).map(p => p.display_name),
    partners: students.filter(p => p.avatar_key === key).length
  });
  const sections = [['기본 펫', '랜덤 알', STANDARD_PET_KEYS, ''], ['영웅 펫', '영웅 알 · 코인 뽑기', EPIC_PET_KEYS, ' epic'], ['전설 펫', '코인 뽑기 · 영웅 알 1%', LEGENDARY_PET_KEYS, ' legend'], ['한정 펫', '시즌에만 파는 알', LIMITED_PET_KEYS, ' limited']];
  let no = 0;
  const withPet = students.filter(p => (p.pets || []).length).length;
  const sale = seasonOnSale();
  return `<section class="pb-progress pb-teacher-sum" aria-label="펫 현황">
      <div><b>${num(sections.reduce((n, x) => n + x[2].length, 0))}</b><span>종의 펫 · 학생 ${num(withPet)}/${num(students.length)}명이 펫을 키워요</span></div>
      <small>${sections.map(([name, , keys]) => `${name.replace(' 펫', '')} ${num(keys.length)}`).join(' · ')}${sale ? ` · <b>${esc(sale.name)} 한정 알 판매 중(${esc(sale.until)}까지)</b>` : ''}</small>
    </section>
    ${sections.map(([name, how, keys, cls]) => `<h2 class="pb-section${cls}">${name} <small>${how}</small></h2>
      <div class="pb-grid">${keys.map(key => card(key, ++no, { form: 3 }, ownersOf(key))).join('')}</div>`).join('')}`;
}
