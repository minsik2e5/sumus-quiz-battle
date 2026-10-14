import { esc } from './ui.js';
import { playSound, soundOn } from './sound.js';

// V13.150 알을 받았을 때 "누구의 알인지": 공개 화면의 알을 톡톡 세 번 두드리면 금이 가고 빛이 터지며 아기 모습(1단계)이 나온다.
// 미리 보기일 뿐 실제 펫은 그대로 알 단계(Lv.3에 깨어난다). 일반 알(pet-moments.js) · 영웅 · 한정 · 전설 알(lucky.js)이 같이 쓴다.
export const EGG_TAPS = 3;
const CRACKS = ['M50 14 L45 30 L55 40 L47 54', 'M55 40 L67 47 L63 60', 'M45 30 L33 37 L30 50', 'M47 54 L40 64'];

export function eggTapHtml(key, name = '', cls = '') {
  return `<div class="etp ${cls}" data-etp="${esc(key)}" data-tap="0" role="button" tabindex="0" aria-label="${esc(name)}의 알 톡톡 두드리기">
    <i class="etp-glow"></i>
    <img class="etp-baby" src="/assets/pets/${esc(key)}-1.webp" alt="${esc(name)} 아기 모습" draggable="false">
    <span class="etp-eggwrap"><img class="etp-egg" src="/assets/pets/${esc(key)}-0.webp" alt="" draggable="false">
      <svg class="etp-cracks" viewBox="0 0 100 100" aria-hidden="true">${CRACKS.map((d, i) => `<path class="c${i}" d="${d}"/>`).join('')}</svg></span>
    <i class="etp-burst"></i>
    <span class="etp-bits" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<b style="--a:${i * 36}deg;--d:${(i % 3) * 30}ms"></b>`).join('')}</span>
    <span class="etp-hint"><i class="etp-hand"></i><b>톡톡 터치해 보세요!</b></span>
    <span class="etp-dots" aria-hidden="true">${'<i></i>'.repeat(EGG_TAPS)}</span>
  </div>
  <p class="etp-note" aria-live="polite"><b>아기 모습</b>이 궁금하면 알을 톡톡!</p>`;
}

// root 안의 알(.etp)에 두드리기를 붙인다. 열리면 onOpen().
export function bindEggTap(root, { onOpen } = {}) {
  const egg = root?.querySelector('.etp');
  if (!egg || egg.dataset.bound) return;
  egg.dataset.bound = '1';
  const note = root.querySelector('.etp-note');
  const sfx = (k, o) => { try { if (soundOn()) playSound(k, o); } catch {} };
  const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
  const tap = e => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const n = Number(egg.dataset.tap || 0);
    if (n >= EGG_TAPS) return;
    const next = n + 1;
    egg.dataset.tap = String(next);
    egg.classList.remove('hit'); void egg.offsetWidth; egg.classList.add('hit');
    egg.querySelectorAll('.etp-dots i').forEach((d, i) => d.classList.toggle('on', i < next));
    if (next < EGG_TAPS) { sfx('tap', { rate: .9 + next * .15 }); sfx('crack', { gain: .35 + next * .15, rate: 1.2 }); buzz(25 + next * 15); if (note) note.innerHTML = next === 1 ? '<b>조금만 더!</b> 금이 갔어요' : '<b>한 번 더!</b> 곧 나와요'; return; }
    egg.classList.add('open');
    sfx('burst'); sfx('levelup', { gain: .6 }); buzz([40, 30, 120]);
    if (note) note.innerHTML = '<b>아기 모습</b>이에요! Lv.3이 되면 이 모습으로 깨어나요.';
    onOpen?.();
  };
  egg.addEventListener('pointerdown', tap);
  egg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') tap(e); });
  egg.addEventListener('click', e => e.stopPropagation());
}
