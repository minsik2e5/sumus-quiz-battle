// Hatching scene: the egg wobbles, cracks with each tap, bursts, and the baby pops out.
// hatchScene(root, key, { onHatched }) renders into `root` and returns { tap, auto, reset }.
// Depends on avatar(), petJosa() and CHARACTERS (pet art module).

// Where the egg sits inside each egg sprite (percent of the 512 canvas): centre and width.
const HATCH_EGG_BOX = { dog: { x: 50, y: 50, w: 58 }, pig: { x: 50, y: 50, w: 58 }, default: { x: 50, y: 52, w: 40 } };
const HATCH_TAPS = 3;

function hatchStyles() {
  if (document.getElementById('hatch-styles')) return;
  const css = `
.hatch{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;user-select:none}
.hatch-stage{position:relative;width:min(260px,70vw);aspect-ratio:1;touch-action:manipulation}
.hatch-stage .avatar-art img,.hatch-stage .avatar-art svg{width:100%;height:auto;display:block}
.hatch-stage .avatar-stage-name{display:none}
.hatch-egg,.hatch-baby,.hatch-glow,.hatch-flash,.hatch-bits{position:absolute;inset:0}
.hatch-egg{cursor:pointer;transform-origin:50% 88%;transition:transform .5s,opacity .25s,filter .3s;-webkit-tap-highlight-color:transparent}
.hatch-egg:focus-visible{outline:3px solid #0b6e50;outline-offset:4px;border-radius:24px}
.hatch[data-state="idle"] .hatch-egg{animation:hatch-idle 2.4s ease-in-out infinite}
.hatch-egg.wobble{animation:hatch-wobble .55s ease-in-out}
.hatch-egg.wobble.big{animation:hatch-wobble-big .6s ease-in-out}
.hatch[data-state="charging"] .hatch-egg{animation:hatch-shake .09s linear infinite;filter:brightness(1.12) drop-shadow(0 0 18px rgba(255,214,90,.9))}
.hatch[data-state="hatched"] .hatch-egg{opacity:0;transform:scale(1.25);pointer-events:none}
.hatch-cracks{position:absolute;pointer-events:none;overflow:visible}
.hatch-cracks path{fill:none;stroke:#7a5a33;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:120;stroke-dashoffset:120;transition:stroke-dashoffset .35s ease-out}
.hatch-cracks path.on{stroke-dashoffset:0}
.hatch-glow{border-radius:50%;background:radial-gradient(circle,rgba(255,226,120,.75),rgba(255,226,120,0) 62%);opacity:0;transform:scale(.6);transition:opacity .9s,transform .9s;pointer-events:none}
.hatch[data-state="charging"] .hatch-glow{opacity:1;transform:scale(1.15)}
.hatch[data-state="hatched"] .hatch-glow{opacity:.55;transform:scale(1.05);animation:hatch-pulse 2.2s ease-in-out infinite}
.hatch-flash{background:radial-gradient(circle,#fff 0 30%,rgba(255,255,255,0) 70%);opacity:0;pointer-events:none;transform:scale(.4)}
.hatch-flash.on{animation:hatch-flash .7s ease-out}
.hatch-baby{opacity:0;transform:scale(.2) translateY(20%);pointer-events:none}
.hatch[data-state="hatched"] .hatch-baby{animation:hatch-pop .8s cubic-bezier(.2,1.6,.4,1) forwards}
.hatch[data-state="hatched"] .hatch-baby .avatar-art{animation:hatch-bounce 2.4s ease-in-out .9s infinite}
.hatch-bits{pointer-events:none}
.hatch-bit{position:absolute;left:50%;top:48%;width:var(--s);height:calc(var(--s)*.8);background:#fff7e6;border:2px solid #d9b98a;clip-path:polygon(50% 0,100% 70%,70% 100%,0 80%);animation:hatch-fly .9s cubic-bezier(.2,.7,.3,1) forwards}
.hatch-star{position:absolute;left:50%;top:48%;width:var(--s);height:var(--s);background:var(--c);clip-path:polygon(50% 0,61% 38%,100% 50%,61% 62%,50% 100%,39% 62%,0 50%,39% 38%);animation:hatch-fly 1.2s cubic-bezier(.2,.7,.3,1) forwards}
.hatch-msg{margin:0;font-family:var(--display,"Jua",system-ui,sans-serif);font-size:20px;color:var(--ink,#17242f);min-height:1.4em;text-wrap:balance}
.hatch-msg b{color:var(--primary-deep,#07815f);font-weight:400}
.hatch-dots{display:flex;gap:6px}
.hatch-dots span{width:10px;height:10px;border-radius:50%;background:#e2e8e5;transition:background .2s,transform .2s}
.hatch-dots span.on{background:#f2a60c;transform:scale(1.15)}
.hatch-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.hatch-btn{appearance:none;border:0;border-radius:12px;padding:10px 16px;font-family:var(--display,"Jua",system-ui,sans-serif);font-size:16px;cursor:pointer;background:var(--primary,#12b886);color:#fff;box-shadow:0 3px 0 var(--primary-deep,#07815f)}
.hatch-btn.ghost{background:#eef3f0;color:var(--ink,#17242f);box-shadow:0 3px 0 #cdd8d3}
.hatch-btn:active{transform:translateY(2px)}
.hatch-btn:focus-visible{outline:3px solid #0b6e50;outline-offset:2px}
@keyframes hatch-idle{0%,100%{transform:rotate(0)}8%{transform:rotate(-4deg)}16%{transform:rotate(4deg)}24%{transform:rotate(0)}}
@keyframes hatch-wobble{0%,100%{transform:rotate(0)}20%{transform:rotate(-9deg)}45%{transform:rotate(8deg)}70%{transform:rotate(-5deg)}}
@keyframes hatch-wobble-big{0%,100%{transform:rotate(0) scale(1)}15%{transform:rotate(-14deg) scale(1.04)}40%{transform:rotate(12deg) scale(1.06)}65%{transform:rotate(-8deg)}85%{transform:rotate(4deg)}}
@keyframes hatch-shake{0%{transform:translate(-2px,0) rotate(-2deg)}50%{transform:translate(2px,-1px) rotate(2deg)}100%{transform:translate(-2px,0) rotate(-2deg)}}
@keyframes hatch-flash{0%{opacity:0;transform:scale(.4)}30%{opacity:1;transform:scale(1.3)}100%{opacity:0;transform:scale(1.6)}}
@keyframes hatch-pop{0%{opacity:0;transform:scale(.2) translateY(20%)}60%{opacity:1}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes hatch-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4%)}}
@keyframes hatch-pulse{50%{opacity:.3}}
@keyframes hatch-fly{0%{opacity:1;transform:translate(-50%,-50%) rotate(0)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){.hatch-egg,.hatch-egg.wobble,.hatch[data-state] .hatch-egg,.hatch[data-state="hatched"] .hatch-baby .avatar-art{animation:none!important}.hatch[data-state="hatched"] .hatch-baby{animation:none;opacity:1;transform:none}.hatch-bit,.hatch-star{display:none}}`;
  const tag = document.createElement('style');
  tag.id = 'hatch-styles'; tag.textContent = css;
  document.head.appendChild(tag);
}

function hatchScene(root, key, { onHatched } = {}) {
  hatchStyles();
  const name = (CHARACTERS[key] || CHARACTERS.dog).ko;
  const box = HATCH_EGG_BOX[key] || HATCH_EGG_BOX.default;
  const cracks = [
    'M18 46 L30 40 L38 50 L48 42',
    'M48 42 L58 52 L68 44 L82 50',
    'M26 62 L36 56 L46 64 L56 57 L66 65 L76 58'
  ];
  root.innerHTML = `
<div class="hatch" data-state="idle">
  <div class="hatch-stage">
    <div class="hatch-glow"></div>
    <div class="hatch-baby">${avatar(key, { stage: 1, expression: 'happy' })}</div>
    <div class="hatch-egg" role="button" tabindex="0" aria-label="알 두드리기">
      ${avatar(key, { stage: 0 })}
      <svg class="hatch-cracks" viewBox="0 0 100 100" style="left:${box.x - box.w / 2}%;top:${box.y - box.w / 2}%;width:${box.w}%;height:${box.w}%">${cracks.map(d => `<path d="${d}"/>`).join('')}</svg>
    </div>
    <div class="hatch-flash"></div>
    <div class="hatch-bits"></div>
  </div>
  <p class="hatch-msg" aria-live="polite">알이 꿈틀거려요! 톡톡 두드려 보세요</p>
  <div class="hatch-dots">${'<span></span>'.repeat(HATCH_TAPS)}</div>
  <div class="hatch-actions"><button class="hatch-btn ghost" type="button" data-act="auto">자동으로 보기</button></div>
</div>`;
  const $ = sel => root.querySelector(sel);
  const scene = $('.hatch'), egg = $('.hatch-egg'), msg = $('.hatch-msg');
  let taps = 0, busy = false, autoTimer = 0;

  function burst() {
    const bits = $('.hatch-bits'); bits.innerHTML = '';
    const colors = ['#ffd85a', '#12b886', '#ff9fb2', '#8fd3ff'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * .4, d = 70 + Math.random() * 60;
      bits.insertAdjacentHTML('beforeend', `<i class="hatch-bit" style="--s:${10 + Math.random() * 12}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 20}px;--r:${Math.random() * 540 - 270}deg"></i>`);
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 70;
      bits.insertAdjacentHTML('beforeend', `<i class="hatch-star" style="--s:${8 + Math.random() * 10}px;--c:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.random() * 360}deg"></i>`);
    }
  }

  function tap() {
    if (busy || scene.dataset.state === 'hatched') return;
    taps++;
    scene.dataset.state = 'tapping';
    root.querySelectorAll('.hatch-dots span').forEach((s, i) => s.classList.toggle('on', i < taps));
    root.querySelectorAll('.hatch-cracks path').forEach((p, i) => p.classList.toggle('on', i < taps));
    egg.classList.remove('wobble', 'big'); void egg.offsetWidth;
    egg.classList.add('wobble'); if (taps > 1) egg.classList.add('big');
    if (taps < HATCH_TAPS) { msg.textContent = taps === 1 ? '앗, 금이 갔어요!' : '조금만 더! 한 번만 더 두드려요'; return; }
    busy = true;
    msg.textContent = '알이 빛나기 시작했어요…';
    scene.dataset.state = 'charging';
    setTimeout(() => {
      const flash = $('.hatch-flash'); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      burst();
      scene.dataset.state = 'hatched';
      msg.innerHTML = `<b>${petJosa(name, '이', '가')}</b> 태어났어요!`;
      $('.hatch-actions').innerHTML = '<button class="hatch-btn" type="button" data-act="reset">다시 보기</button>';
      busy = false;
      onHatched?.(key);
    }, 1100);
  }
  function auto() {
    clearTimeout(autoTimer);
    const step = () => { tap(); if (taps < HATCH_TAPS) autoTimer = setTimeout(step, 700); };
    step();
  }
  function reset() { clearTimeout(autoTimer); hatchScene(root, key, { onHatched }); }

  egg.addEventListener('click', tap);
  egg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
  root.querySelector('.hatch-actions').addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'auto') auto();
    if (act === 'reset') reset();
  });
  return { tap, auto, reset };
}
