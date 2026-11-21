// 시안용 작은 인터랙션. 앱 코드가 아니다.
//  - [data-seg] 안의 버튼: 하나만 고른다(.on)
//  - [data-check]: 학습 화면의 "정답 확인" → 폰에 .answered를 붙였다 뗀다
//  - [data-count]: 화면이 들어올 때 0부터 숫자를 센다
//  - .replay 또는 폰 위 제목을 누르면 들어오는 움직임을 다시 본다
const still = new URLSearchParams(location.search).has('still');
if (still) document.documentElement.classList.add('still');

document.addEventListener('click', e => {
  const seg = e.target.closest('[data-seg] button');
  if (seg) { seg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg)); return; }
  const check = e.target.closest('[data-check]');
  if (check) { check.closest('.phone').classList.toggle('answered'); return; }
  const cap = e.target.closest('.shot>figcaption');
  if (cap) return replay(cap.parentElement.querySelector('.phone'));
  if (e.target.closest('.replay')) document.querySelectorAll('.phone').forEach(replay);
});

function replay(phone) {
  const html = phone.innerHTML; phone.innerHTML = ''; void phone.offsetWidth; phone.innerHTML = html; count(phone);
}
function count(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = Number(el.dataset.count), t0 = performance.now(), dur = 900;
    if (still) { el.textContent = to; return; }
    const tick = t => { const k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = v; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
count(document);
