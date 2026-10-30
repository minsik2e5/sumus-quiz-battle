import { CHARACTERS, STANDARD_PET_KEYS, EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, LIMITED_PET_KEYS, SOON_PET_KEYS, ZODIAC_PET_KEYS, SERIES_PET_KEYS, SERIES_EGG, SERIES_RANKS, seriesGroupKeys, SEASONS, seasonOnSale, PET_FORMS, PET_FORM_LEVELS, EGG_PRICE, EPIC_EGG_PRICE, EPIC_EGG_LEGENDARY_RATE } from './core.js';
import { icon, esc, num } from './ui.js';
import { SERIES_EGG_ART } from './pet-art.js';
import { PET_SKILLS } from './battle-engine.js';
import { petDisplayName } from './pet-moments.js';
import { LEGENDARY_RATE, LEGENDARY_PITY, EPIC_RATE, MYTHIC_RATE } from './rewards.js';

// V13.91 펫 도감: every pet of the game under 나. A pet the student has met shows its forms
// (the forms it has reached in colour, the next ones as shadows); a pet not met yet is a shadow
// with how to meet it. V13.185: every pet (전설 · 신화 · 한정 too) shows its yacha skill.
const sprite = (key, form, shadow) => `<img class="pb-sprite${shadow ? ' shadow' : ''}" src="/assets/pets/${key}-${form}-s.webp" alt="" width="160" height="160" loading="lazy" decoding="async" draggable="false">`;

// V13.112 `teacher`: { owners: [names], partners: n } shows the pet to a teacher (every form in colour,
// how it is met, and which students have it) instead of a student's own collection.
function card(key, no, pet, teacher = null) {
  // V13.195 곤충 · 공룡 시리즈 펫은 시리즈 등급(rank)으로 테두리 · 표시를 빌린다(전역 등급 셈과는 따로).
  const c = CHARACTERS[key], series = c.series ? c.rank : null, mythic = !!c.mythic, legend = !!c.legendary || series === 'legendary', epic = !!c.epic || series === 'epic', season = c.limited ? SEASONS[c.limited] : null, skill = PET_SKILLS[key];
  const met = !!pet, form = met ? pet.form : -1;
  const forms = PET_FORMS.map((label, f) => {
    const seen = met && f <= form;
    return `<figure class="pb-form ${seen ? 'seen' : ''}">${sprite(key, f, !seen)}<figcaption>${seen ? label : f ? `Lv.${PET_FORM_LEVELS[f]}` : '알'}</figcaption></figure>`;
  }).join('');
  // V13.109 한정 펫: its season's egg while on sale, then only 영웅 eggs.
  const how = series ? `알 상점의 ${SERIES_EGG.name} ${num(SERIES_EGG.price)}코인 · 시리즈 ${SERIES_RANKS[series]}(이미 만난 친구는 다시 안 나와요)` : season ? (seasonOnSale()?.id === c.limited ? `${season.egg} ${num(season.price)}코인 · ${season.until}까지 판매` : `${season.name} 한정 · 지금은 영웅 알 · 코인 뽑기 영웅 알에서 ${season.after_rate}%`) : mythic ? `모든 알에서 아주 낮은 확률(랜덤 알 ${MYTHIC_RATE.basic}% · 영웅 알 ${MYTHIC_RATE.epic}% · 코인 뽑기 ${MYTHIC_RATE.capsule}%) · 뽑기 확정은 없어요 · 학생마다 1마리` : legend ? `코인 뽑기 ${LEGENDARY_RATE}% · 영웅 알 ${EPIC_EGG_LEGENDARY_RATE}% · 뽑기 ${num(LEGENDARY_PITY)}번 안에 확정` : epic ? `영웅 알 ${num(EPIC_EGG_PRICE)}코인 · 코인 뽑기 ${EPIC_RATE}%` : `상점의 랜덤 알 · ${num(EGG_PRICE)}코인`;
  const foot = met
    // V13.185 전설 · 신화 · 한정 펫에도 야차전 특기가 있다(등급 색 그대로).
    ? skill ? `<span class="pb-skill${season ? ' limited' : mythic ? ' mythic' : legend ? ' gold' : ''}">야차전 특기</span><b>${esc(skill.name)}</b><small>${esc(skill.desc)}</small>` : ''
    : `<span class="pb-skill lock">${icon('lock')}만나는 법</span><small>${how}</small>`;
  const name = met ? `<b>${esc(c.ko)}</b>${pet.name ? `<em>${esc(petDisplayName(pet))}</em>` : ''}` : '<b>???</b>';
  return `<article class="pb-card ${mythic ? 'mythic ' : ''}${legend ? 'legend' : ''}${epic ? 'epic' : ''}${season ? 'limited' : ''} ${met ? 'met' : 'unmet'}" style="--pc:${c.color};--pl:${c.light};--ps:${c.soft}" aria-label="${met ? esc(c.ko) : '아직 못 만난 펫'}">
    <header><span class="pb-no">No.${String(no).padStart(2, '0')}</span>${name}<span class="pb-type">${met || mythic || legend || epic || season ? esc(c.type) : '?'}</span>${season ? `<span class="pb-limited">🎃 ${esc(season.name)} 한정</span>` : mythic ? '<span class="pb-mythic">✦ 신화</span>' : legend ? '<span class="pb-legend">★ 전설</span>' : epic ? '<span class="pb-epic">★ 영웅</span>' : ''}${series ? `<span class="pb-series-tag ${c.group}">${c.group === 'bug' ? '곤충' : '공룡'}</span>` : ''}</header>
    <div class="pb-forms">${forms}</div>
    <footer>${foot}${teacher ? `<span class="pb-lv pb-owners${teacher.owners.length ? '' : ' none'}">보유 ${num(teacher.owners.length)}명</span>` : met ? `<span class="pb-lv">Lv.${num(pet.level || 1)}</span>` : ''}</footer>
    ${teacher ? `<div class="pb-teacher"><p><b>얻는 법</b>${how}</p><p class="pb-owner-names"><b>보유 학생</b>${teacher.owners.length ? `${teacher.owners.slice(0, 8).map(n => `<span>${esc(n)}</span>`).join('')}${teacher.owners.length > 8 ? `<em>외 ${num(teacher.owners.length - 8)}명</em>` : ''}${teacher.partners ? `<em class="partner">파트너 ${num(teacher.partners)}명</em>` : ''}` : '<em>아직 없어요</em>'}</p></div>` : ''}
  </article>`;
}

// V13.168 곧 만나요: 그림을 그리고 있는 새 펫(core.js SOON_PET_KEYS)은 이름 없이 그림자 칸만. 그림이 들어오면 위 칸으로 옮겨 간다.
function soonCard(key) {
  const c = CHARACTERS[key], tier = c.series ? (c.group === 'bug' ? '곤충' : '공룡') : c.mythic ? '신화' : c.epic ? '영웅' : ZODIAC_PET_KEYS.includes(key) ? '12지' : '기본';
  const lock = c.mythic ? 'pet-legend-locked' : c.epic ? 'pet-epic-locked' : 'pet-locked';
  return `<article class="pb-card pb-soon ${c.mythic ? 'mythic' : c.epic ? 'epic' : ''} unmet" style="--pc:${c.color};--pl:${c.light};--ps:${c.soft}" aria-label="곧 만나는 펫">
    <header><span class="pb-no">NEW</span><b>???</b><span class="pb-type">${esc(c.type)}</span><span class="pb-soon-tag">${tier}</span></header>
    <div class="pb-soon-art"><img src="/assets/ui/${lock}.webp" alt="" width="96" height="96" loading="lazy" decoding="async" draggable="false"></div>
    <footer><span class="pb-skill lock">${icon('lock')}곧 만나요</span><small>그림을 그리고 있어요. 그림이 오면 ${c.series ? `${esc(SERIES_EGG.name)}에서` : c.mythic ? '모든 알에서 아주 낮은 확률로' : c.epic ? '영웅 알에서' : '랜덤 알에서'} 만날 수 있어요</small></footer>
  </article>`;
}
const soonSection = () => SOON_PET_KEYS.length ? `<h2 class="pb-section soon">곧 만나요 <small>새 펫 ${num(SOON_PET_KEYS.length)}마리를 그리고 있어요</small></h2>
    <div class="pb-grid">${SOON_PET_KEYS.map(soonCard).join('')}</div>` : '';

export function petBookPage(A) {
  const owned = A.data.stats?.pets || [], mine = key => owned.find(pet => pet.key === key);
  const all = [...STANDARD_PET_KEYS, ...EPIC_PET_KEYS, ...LEGENDARY_PET_KEYS, ...MYTHIC_PET_KEYS, ...LIMITED_PET_KEYS, ...SERIES_PET_KEYS], met = all.filter(mine).length;
  const metOf = keys => keys.filter(mine).length;
  const pct = Math.round(met / all.length * 100);
  return `<button type="button" class="page-back-v1368" data-go="me">${icon('back')}나</button>
    <div class="page-heading pb-head"><span class="premium-eyebrow">PET DEX</span><h1>펫 도감</h1><p>만난 펫은 자란 모습까지, 아직 못 만난 펫은 그림자로 보여요.</p></div>
    <section class="pb-progress" aria-label="도감 진행">
      <div><b>${num(met)}</b><span>/ ${num(all.length)} 마리 만났어요</span></div>
      <i style="--p:${pct}%" aria-hidden="true"></i>
      <small>기본 펫 ${num(metOf(STANDARD_PET_KEYS))}/${num(STANDARD_PET_KEYS.length)} · 영웅 펫 ${num(metOf(EPIC_PET_KEYS))}/${num(EPIC_PET_KEYS.length)} · 전설 펫 ${num(metOf(LEGENDARY_PET_KEYS))}/${num(LEGENDARY_PET_KEYS.length)} · 신화 펫 ${num(metOf(MYTHIC_PET_KEYS))}/${num(MYTHIC_PET_KEYS.length)} · 한정 펫 ${num(metOf(LIMITED_PET_KEYS))}/${num(LIMITED_PET_KEYS.length)}${SERIES_PET_KEYS.length ? ` · 곤충 · 공룡 ${num(metOf(SERIES_PET_KEYS))}/${num(SERIES_PET_KEYS.length)}` : ''}</small>
    </section>
    <h2 class="pb-section">기본 펫</h2>
    <div class="pb-grid">${STANDARD_PET_KEYS.map((key, i) => card(key, i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section epic">영웅 펫 <small>전설 바로 아래</small></h2>
    <div class="pb-grid">${EPIC_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section legend">전설 펫</h2>
    <div class="pb-grid">${LEGENDARY_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length + i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section mythic">신화 펫 <small>전설보다 위 · 모든 알에서 아주 낮은 확률 · 학생마다 1마리</small></h2>
    <div class="pb-grid">${MYTHIC_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length + LEGENDARY_PET_KEYS.length + i + 1, mine(key))).join('')}</div>
    <h2 class="pb-section limited">한정 펫 <small>시즌에만 파는 알</small></h2>
    <div class="pb-grid">${LIMITED_PET_KEYS.map((key, i) => card(key, STANDARD_PET_KEYS.length + EPIC_PET_KEYS.length + LEGENDARY_PET_KEYS.length + MYTHIC_PET_KEYS.length + i + 1, mine(key))).join('')}</div>
    ${seriesSection(key => card(key, all.length - SERIES_PET_KEYS.length + seriesKeys().indexOf(key) + 1, mine(key)), metOf)}
    ${soonSection()}`;
}
// V13.195 곤충 · 공룡 시리즈 칸(시리즈 알에서만): 곤충 · 공룡 진행과 시리즈 등급 순(기본 → 영웅 → 전설) 카드.
const SERIES_ORDER = ['basic', 'epic', 'legendary'];
const seriesKeys = () => [...SERIES_PET_KEYS].sort((a, b) => SERIES_ORDER.indexOf(CHARACTERS[a].rank) - SERIES_ORDER.indexOf(CHARACTERS[b].rank));
function seriesSection(cardOf, metOf = null) {
  if (!SERIES_PET_KEYS.length) return '';
  const bug = seriesGroupKeys('bug'), dino = seriesGroupKeys('dino');
  return `<h2 class="pb-section series"><img src="/assets/ui/${SERIES_EGG_ART}.webp" alt="" width="34" height="34" loading="lazy" decoding="async">곤충 · 공룡 시리즈 <small>${esc(SERIES_EGG.name)}에서만 · 이미 만난 친구는 다시 안 나와요</small></h2>
    ${metOf ? `<p class="pb-series-prog">곤충 ${num(metOf(bug))}/${num(bug.length)} · 공룡 ${num(metOf(dino))}/${num(dino.length)}</p>` : ''}
    <div class="pb-grid">${seriesKeys().map(cardOf).join('')}</div>`;
}

// V13.112 선생님 화면의 펫 도감: all pets with every form, the yacha skill, how a student meets it and
// which students of the school have it (the student's own dex is petBookPage).
export function teacherPetDex(A) {
  const students = (A.data.profiles || []).filter(p => p.active !== false && !p.preview_owner_id && p.role !== 'teacher');
  const ownersOf = key => ({
    owners: students.filter(p => (p.pets || []).some(pet => pet.key === key)).map(p => p.display_name),
    partners: students.filter(p => p.avatar_key === key).length
  });
  const sections = [['기본 펫', '랜덤 알', STANDARD_PET_KEYS, ''], ['영웅 펫', '영웅 알 · 코인 뽑기', EPIC_PET_KEYS, ' epic'], ['전설 펫', '코인 뽑기 · 영웅 알 1%', LEGENDARY_PET_KEYS, ' legend'], ['신화 펫', '모든 알에서 아주 낮은 확률 · 학생마다 1마리', MYTHIC_PET_KEYS, ' mythic'], ['한정 펫', '시즌에만 파는 알', LIMITED_PET_KEYS, ' limited']];
  let no = 0;
  const withPet = students.filter(p => (p.pets || []).length).length;
  const sale = seasonOnSale();
  return `<section class="pb-progress pb-teacher-sum" aria-label="펫 현황">
      <div><b>${num(sections.reduce((n, x) => n + x[2].length, 0) + SERIES_PET_KEYS.length)}</b><span>종의 펫 · 학생 ${num(withPet)}/${num(students.length)}명이 펫을 키워요</span></div>
      <small>${sections.map(([name, , keys]) => `${name.replace(' 펫', '')} ${num(keys.length)}`).join(' · ')}${SERIES_PET_KEYS.length ? ` · 곤충 · 공룡 ${num(SERIES_PET_KEYS.length)}` : ''}${sale ? ` · <b>${esc(sale.name)} 한정 알 판매 중(${esc(sale.until)}까지)</b>` : ''}</small>
    </section>
    ${sections.map(([name, how, keys, cls]) => `<h2 class="pb-section${cls}">${name} <small>${how}</small></h2>
      <div class="pb-grid">${keys.map(key => card(key, ++no, { form: 3 }, ownersOf(key))).join('')}</div>`).join('')}
    ${seriesSection(key => card(key, ++no, { form: 3 }, ownersOf(key)))}
    ${soonSection()}`;
}
