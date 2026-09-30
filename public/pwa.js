let deferredInstallPrompt = null;

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

function mobileLike() {
  return window.matchMedia?.('(max-width: 760px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function dismissInstallHint(node) {
  try { localStorage.setItem('sumus:pwa-hint:v1326', 'dismissed'); } catch {}
  node?.remove();
}

async function requestInstall(node) {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice?.outcome === 'accepted') return dismissInstallHint(node);
    } catch {}
  }
  // V13.77: no one-tap install here (iPhone, or the browser has not offered it): the guide page.
  location.href = '/install';
}

function showInstallHint() {
  if (standalone() || !mobileLike() || document.querySelector('.pwa-install-hint')) return;
  if (!document.querySelector('.student-app') || document.querySelector('.session-app')) return;
  try { if (localStorage.getItem('sumus:pwa-hint:v1326') === 'dismissed') return; } catch {}

  const node = document.createElement('aside');
  node.className = 'pwa-install-hint';
  node.setAttribute('role', 'status');
  node.innerHTML = `
    <button class="pwa-install-close" type="button" aria-label="설치 안내 닫기">×</button>
    <div class="pwa-install-mark">S</div>
    <div class="pwa-install-copy">
      <strong>앱처럼 더 넓게 학습하세요</strong>
      <span>홈 화면에 추가하면 주소창 없이 SUMUS VOCA를 사용할 수 있어요.</span>
    </div>
    <button class="pwa-install-action" type="button">앱으로 사용</button>
  `;
  document.body.appendChild(node);
  node.querySelector('.pwa-install-close')?.addEventListener('click', () => dismissInstallHint(node));
  node.querySelector('.pwa-install-action')?.addEventListener('click', () => requestInstall(node));
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  document.querySelector('.pwa-install-hint')?.remove();
  try { localStorage.setItem('sumus:pwa-hint:v1326', 'dismissed'); } catch {}
});

// A new version installs in the background (sw.js). Switch to it only when
// the switch cannot interrupt anything: no exam/practice screen, no open
// dialog, nobody typing. The switch reloads the page from the new cache.
function updateIsSafe() {
  return !document.querySelector('.session-app') && !document.querySelector('#modal-root .modal') &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}
function applyWaitingUpdate(registration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) return;
  if (updateIsSafe()) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  else setTimeout(() => applyWaitingUpdate(registration), 5000);
}

if ('serviceWorker' in navigator) {
  // On a first visit the worker takes control without a page swap; only a
  // version change should reload.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    // A worker can also take over on its own (e.g. replacing a broken one);
    // still never reload in the middle of an exam or practice.
    const reloadWhenSafe = () => updateIsSafe() ? location.reload() : setTimeout(reloadWhenSafe, 3000);
    reloadWhenSafe();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      applyWaitingUpdate(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed') applyWaitingUpdate(registration); });
      });
      registration.update().catch(() => {});
    }).catch(() => {});
    setTimeout(showInstallHint, 1400);
  });
}

const pwaObserver = new MutationObserver(() => {
  if (!standalone() && !document.querySelector('.session-app')) showInstallHint();
  else document.querySelector('.pwa-install-hint')?.remove();
});
pwaObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
