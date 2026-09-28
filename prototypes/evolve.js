// Evolution scene: light gathers, the pet turns into a glowing silhouette that flickers
// between its old and new forms faster and faster, then bursts into the new form.
// evolveScene(root, key, from, to, { onEvolved }) renders into `root` and returns { start, reset }.
// Depends on avatar(), petJosa(), PET_FORMS and CHARACTERS (pet art module).

// Gaps (ms) between old/new silhouette swaps: slow at first, then a rapid shimmer.
const EVO_FLICKER = [460, 400, 340, 280, 230, 190, 150, 120, 95, 75, 60, 50, 45, 40, 40, 40];
const EVO_CHARGE_MS = 1300;

function evolveStyles() {
  if (document.getElementById('evolve-styles')) return;
  const css = `
.evo{position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;border-radius:20px;padding:18px 16px 20px;background:radial-gradient(120% 90% at 50% 0%,#f3fbf7,#ffffff 60%);box-shadow:0 0 0 1px var(--line,#dde6e2) inset;overflow:hidden;user-select:none}
.evo::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(circle at 50% 40%,#2f5e4f,#12241d 72%);opacity:0;transition:opacity .7s}
.evo[data-state="charging"]::before,.evo[data-state="flicker"]::before{opacity:1}
.evo-stage{position:relative;width:min(260px,70vw);aspect-ratio:1}
.evo-stage .avatar-art img,.evo-stage .avatar-art svg{width:100%;height:auto;display:block}
.evo-stage .avatar-stage-name{display:none}
.evo-form,.evo-glow,.evo-flash,.evo-bits{position:absolute;inset:0;pointer-events:none}
.evo-form .avatar-art{transition:filter .5s}
.evo-to{opacity:0}
.evo[data-state="ready"] .evo-from .avatar-art{animation:evo-bob 2.6s ease-in-out infinite}
.evo[data-state="charging"] .evo-from .avatar-art{animation:evo-tremble .12s linear infinite;filter:brightness(1.25) drop-shadow(0 0 14px rgba(255,226,120,.9))}
.evo[data-state="flicker"] .evo-form .avatar-art{filter:brightness(0) invert(1) drop-shadow(0 0 12px rgba(255,226,120,.95))}
.evo[data-state="flicker"] .evo-stage.show-to .evo-from{opacity:0}
.evo[data-state="flicker"] .evo-stage.show-to .evo-to{opacity:1}
.evo[data-state="done"] .evo-from{opacity:0}
.evo[data-state="done"] .evo-to{opacity:1;animation:evo-reveal .9s cubic-bezier(.2,1.5,.4,1)}
.evo[data-state="done"] .evo-to .avatar-art{animation:evo-bob 2.4s ease-in-out 1s infinite}
.evo-rays{position:absolute;inset:-18%;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .8s;will-change:transform;
  background:repeating-conic-gradient(from 0deg,rgba(255,222,120,.5) 0 7deg,rgba(255,222,120,0) 7deg 20deg);
  -webkit-mask:radial-gradient(circle,#000 18%,transparent 68%);mask:radial-gradient(circle,#000 18%,transparent 68%)}
.evo[data-state="charging"] .evo-rays,.evo[data-state="flicker"] .evo-rays{opacity:1;animation:evo-spin 7s linear infinite}
.evo[data-state="done"] .evo-rays{opacity:0;transition:opacity 2.5s}
.evo-glow{border-radius:50%;background:radial-gradient(circle,rgba(255,236,160,.8),rgba(255,236,160,0) 60%);opacity:0;transform:scale(.6);transition:opacity .8s,transform .8s}
.evo[data-state="charging"] .evo-glow,.evo[data-state="flicker"] .evo-glow{opacity:1;transform:scale(1.1)}
.evo[data-state="done"] .evo-glow{opacity:.5;transform:scale(1)}
.evo-ring{position:absolute;left:50%;top:55%;width:42%;aspect-ratio:1;border-radius:50%;border:3px solid rgba(255,214,90,.95);transform:translate(-50%,-50%) scale(.3);opacity:0;pointer-events:none}
.evo[data-state="done"] .evo-ring{animation:evo-ring .9s ease-out forwards}
.evo[data-state="done"] .evo-ring.r2{animation-delay:.18s;border-color:rgba(18,184,134,.8)}
.evo-flash{background:radial-gradient(circle,#fff 0 35%,rgba(255,255,255,0) 72%);opacity:0;transform:scale(.4)}
.evo-flash.on{animation:evo-flash .75s ease-out}
.evo-star{position:absolute;left:50%;top:50%;width:var(--s);height:var(--s);background:var(--c);clip-path:polygon(50% 0,61% 38%,100% 50%,61% 62%,50% 100%,39% 62%,0 50%,39% 38%);animation:evo-fly 1.3s cubic-bezier(.2,.7,.3,1) forwards}
.evo-msg{margin:0;font-family:var(--display,"Jua",system-ui,sans-serif);font-size:20px;color:var(--ink,#17242f);min-height:1.4em;text-wrap:balance;transition:color .5s}
.evo[data-state="charging"] .evo-msg,.evo[data-state="flicker"] .evo-msg{color:#fff}
.evo-msg b{color:var(--primary-deep,#07815f);font-weight:400}
.evo-chip{font-size:12px;font-weight:700;color:var(--muted,#6c7c77);transition:color .5s}
.evo[data-state="charging"] .evo-chip,.evo[data-state="flicker"] .evo-chip{color:#b9d4c8}
.evo-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;min-height:42px}
.evo-btn{appearance:none;border:0;border-radius:12px;padding:10px 18px;font-family:var(--display,"Jua",system-ui,sans-serif);font-size:16px;cursor:pointer;background:var(--primary,#12b886);color:#fff;box-shadow:0 3px 0 var(--primary-deep,#07815f)}
.evo-btn.ghost{background:#eef3f0;color:var(--ink,#17242f);box-shadow:0 3px 0 #cdd8d3}
.evo-btn:active{transform:translateY(2px)}
.evo-btn:focus-visible{outline:3px solid #0b6e50;outline-offset:2px}
@keyframes evo-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3%)}}
@keyframes evo-tremble{0%{transform:translate(-1.5px,0)}50%{transform:translate(1.5px,-1px)}100%{transform:translate(-1.5px,0)}}
@keyframes evo-spin{to{transform:rotate(360deg)}}
@keyframes evo-reveal{0%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes evo-ring{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}
@keyframes evo-flash{0%{opacity:0;transform:scale(.4)}30%{opacity:1;transform:scale(1.4)}100%{opacity:0;transform:scale(1.8)}}
@keyframes evo-fly{0%{opacity:1;transform:translate(-50%,-50%) rotate(0)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){.evo *{animation:none!important}.evo-star{display:none}}`;
  const tag = document.createElement('style');
  tag.id = 'evolve-styles'; tag.textContent = css;
  document.head.appendChild(tag);
}

function evolveScene(root, key, from, to, { onEvolved } = {}) {
  evolveStyles();
  const name = (CHARACTERS[key] || CHARACTERS.dog).ko;
  const formLabel = f => `${f}단계 · ${PET_FORMS[f]}`;
  root.innerHTML = `
<div class="evo" data-state="ready">
  <span class="evo-chip">${formLabel(from)} → ${formLabel(to)}</span>
  <div class="evo-stage">
    <div class="evo-rays"></div>
    <div class="evo-glow"></div>
    <div class="evo-form evo-from">${avatar(key, { stage: from })}</div>
    <div class="evo-form evo-to">${avatar(key, { stage: to, expression: 'happy' })}</div>
    <div class="evo-ring"></div><div class="evo-ring r2"></div>
    <div class="evo-flash"></div>
    <div class="evo-bits"></div>
  </div>
  <p class="evo-msg" aria-live="polite">${petJosa(name, '이', '가')} 진화할 준비가 됐어요!</p>
  <div class="evo-actions"><button class="evo-btn" type="button" data-act="start">진화 시작</button></div>
</div>`;
  const q = sel => root.querySelector(sel);
  const scene = q('.evo'), stage = q('.evo-stage'), msg = q('.evo-msg'), actions = q('.evo-actions');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function finish() {
    stage.classList.add('show-to');
    const flash = q('.evo-flash'); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    const bits = q('.evo-bits'), colors = ['#ffd85a', '#12b886', '#ff9fb2', '#8fd3ff', '#ffffff'];
    bits.innerHTML = Array.from({ length: 18 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 80;
      return `<i class="evo-star" style="--s:${8 + Math.random() * 12}px;--c:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 20}px;--r:${Math.random() * 360}deg"></i>`;
    }).join('');
    scene.dataset.state = 'done';
    msg.innerHTML = `<b>${petJosa(name, '이', '가')}</b> ${PET_FORMS[to]} 모습으로 진화했어요!`;
    actions.innerHTML = '<button class="evo-btn ghost" type="button" data-act="reset">다시 보기</button>';
    onEvolved?.(key, to);
  }

  function start() {
    if (scene.dataset.state !== 'ready') return;
    actions.innerHTML = '';
    if (reduced) return finish();
    scene.dataset.state = 'charging';
    msg.textContent = `어? ${name}의 모습이…!`;
    later(() => {
      scene.dataset.state = 'flicker';
      msg.textContent = `${petJosa(name, '이', '가')} 진화하고 있어요!`;
      let t = 0;
      EVO_FLICKER.forEach((gap, i) => { t += gap; later(() => stage.classList.toggle('show-to', i % 2 === 0), t); });
      later(finish, t + 350);
    }, EVO_CHARGE_MS);
  }
  function reset() { timers.forEach(clearTimeout); timers = []; evolveScene(root, key, from, to, { onEvolved }); }

  actions.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'start') start();
    if (act === 'reset') reset();
  });
  return { start, reset };
}
