import { esc } from './ui.js';
import { PET_FORMS } from './core.js';

// V13.149 알을 받았을 때 "누구의 알인지" 바로 알 수 있게: 알 → 아기 → 성장 → 최종 네 모습을 한 줄로 보여 준다.
// 아기 모습(1단계)을 크게 강조한다. 일반 알(pet-moments.js) · 영웅 · 한정 · 전설 알(lucky.js)이 같이 쓴다.
export function growthStrip(key, name = '') {
  return `<div class="pgx-strip" role="img" aria-label="${esc(name)} 자라는 모습: ${PET_FORMS.join(', ')}">
    ${PET_FORMS.map((label, form) => `${form ? '<i class="pgx-arrow" aria-hidden="true"></i>' : ''}<span class="pgx-step${form === 1 ? ' baby' : ''}" style="--d:${form}">
      <img src="/assets/pets/${key}-${form}.webp" alt="" width="128" height="128" decoding="async" draggable="false">
      <small>${form === 1 ? '아기 모습' : esc(label)}</small></span>`).join('')}
  </div>`;
}
