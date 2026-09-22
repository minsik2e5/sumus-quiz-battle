let deferredInstallPrompt = null;

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

function mobileLike() {
  return window.matchMedia?.('(max-width: 760px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function installGuideText() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return '공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택하세요.';
  return '브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택하세요.';
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
  const detail = node?.querySelector('.pwa-install-detail');
  if (detail) {
    detail.hidden = false;
    detail.textContent = installGuideText();
  }
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
      <small class="pwa-install-detail" hidden></small>
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
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
